// MCP Behavioural Diff — differential runtime analysis engine.
// Compares two versions of an MCP server under identical tool-call scenarios.
// Reports BEHAVIOURAL CHANGES with observed-source attribution and evidence.
// It does NOT classify maliciousness.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const N = parseInt(process.env.RUNS || "10", 10);

// --- observed-source attribution (an OBSERVED in->out relationship, not full taint lineage) ---
// Canary tokens are unique markers placed into inputs; if a captured value contains one,
// we record observed_source = where that marker entered. Absence => "unexplained".
const CANARIES = JSON.parse(fs.readFileSync(new URL("./canaries.json", import.meta.url), "utf8"));
function observedSource(v){
  if (v == null) return "null";
  const s = String(v);
  for (const [marker, src] of Object.entries(CANARIES)) if (s.includes(marker)) return src; // tool_argument | environment_variable
  return "unexplained";
}

export function features(lines, results){
  const f = {};
  const seen = {}; // signature -> occurrence count
  for (const l of lines){
    if (l.layer && (l.layer.endsWith(".request") || l.layer === "fetch") && l.method){
      // Align requests by signature, not position, so an added/removed request doesn't shift every later key.
      const sig = `${l.method} ${l.host}:${l.port}${String(l.path||"").split("?")[0]}`;
      const n = seen[sig] = (seen[sig]||0) + 1;
      const key = `net[${sig}]#${n}`;
      f[`${key}.dest`] = `${l.host}:${l.port}${l.path}`;
      f[`${key}.method`] = l.method;
      if (l.body && l.body !== "null"){
        let j; try { j = JSON.parse(l.body); } catch(e){ j = null; }
        if (j && typeof j === "object") for (const [k,v] of Object.entries(j)) f[`${key}.body.${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v);
        else f[`${key}.body.raw`] = l.body;
      }
      if (l.headers) for (const [k,v] of Object.entries(l.headers)) { const kl = String(k).toLowerCase(); if (/token|auth|key|secret|debug/.test(kl)) f[`${key}.hdr.${kl}`] = String(v); } // header names normalized case-insensitively
    }
    if (l.layer && l.layer.startsWith("child_process")) f[`proc#${l.cmd}`] = l.capture || "spawned";
    if (l.layer === "net.connect") f[`rawconn#${l.host}:${l.port}`] = l.capture || "connect";
    if (l.layer && l.layer.startsWith("fs.")){ const p = String(l.path||"").replace(process.env.SBOX||"__SB__","<SB>").replace(/\/[^/]*node_modules.*/,"<nm>"); f[`fs#${p}`] = l.layer; }
  }
  (results||[]).forEach((r,i)=>{ f[`res#${i}.${r.tool}`] = r.error ? "ERR" : (r.text||"").slice(0,500); });
  return f;
}

function runOnce(entry, cap, scenario, extra){
  const MOCK = fs.readFileSync(new URL("./.mockport", import.meta.url), "utf8").trim();
  try { fs.rmSync(cap); } catch(e){}
  let drv; try { drv = execFileSync("node",[new URL("./runner.mjs",import.meta.url).pathname, entry, cap, MOCK, scenario, ...extra], {encoding:"utf8", timeout:30000}); }
  catch(e){ return { meta:{error:"crash",results:[]}, feat:{} }; }
  const meta = JSON.parse(drv.trim().split("\n").pop());
  const lines = fs.existsSync(cap) ? fs.readFileSync(cap,"utf8").trim().split("\n").filter(Boolean).map(l=>JSON.parse(l)) : [];
  return { meta, feat: features(lines, meta.results) };
}

// classify each key's volatility within one version across N runs
function volatility(runs){
  const keys = new Set(); runs.forEach(r=>Object.keys(r.feat).forEach(k=>keys.add(k)));
  const cls = {}; // key -> {distinct, class}
  for (const k of keys){
    const vals = runs.map(r=>r.feat[k]);
    const distinct = new Set(vals).size;
    let c;
    if (distinct === 1) c = "stable";
    else if (distinct >= Math.ceil(N*0.8)) c = "nondeterministic";   // high-confidence noise
    else c = "intermittent";                                          // RETAINED as evidence, never silently dropped
    cls[k] = { distinct, class: c, sampleRuns: N };
  }
  return cls;
}

export function compare(entryA, entryB, scenario, extra){
  const A = []; for (let i=0;i<N;i++) A.push(runOnce(entryA, `/tmp/cap-A-${i}.jsonl`, scenario, extra));
  const B = []; for (let i=0;i<N;i++) B.push(runOnce(entryB, `/tmp/cap-B-${i}.jsonl`, scenario, extra));
  const vA = volatility(A), vB = volatility(B);
  const baseA = A[0].feat, baseB = B[0].feat;
  const allKeys = new Set([...Object.keys(baseA), ...Object.keys(baseB)]);
  const primary_alerts = [], evidence_intermittent = [], suppressed_noise = [];
  for (const k of allKeys){
    const a = baseA[k], b = baseB[k];
    if (a === b) continue; // no behavioural change on this field
    const ca = (vA[k]&&vA[k].class)||"absent", cb = (vB[k]&&vB[k].class)||"absent";
    const item = { field:k, v1: a===undefined?"(absent)":String(a).slice(0,80), v2: b===undefined?"(absent)":String(b).slice(0,80),
                   observed_source: observedSource(b!==undefined?b:a), volatility_v1: ca, volatility_v2: cb };
    // Suppress from PRIMARY only when high-confidence nondeterministic in either version.
    if (ca === "nondeterministic" || cb === "nondeterministic") suppressed_noise.push(item);
    else if (ca === "intermittent" || cb === "intermittent") evidence_intermittent.push(item); // retained, flagged review
    else primary_alerts.push(item); // stable-vs-stable behavioural change
  }
  return {
    scenario, runs:N,
    tools_v1:A[0].meta.tools, tools_v2:B[0].meta.tools,
    primary_alerts, evidence_intermittent, suppressed_noise,
    volatile_fields_v1: Object.entries(vA).filter(([,v])=>v.class!=="stable").map(([k,v])=>({field:k,...v})),
    volatile_fields_v2: Object.entries(vB).filter(([,v])=>v.class!=="stable").map(([k,v])=>({field:k,...v})),
  };
}
