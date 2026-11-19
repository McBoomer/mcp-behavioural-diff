// Usage: node engine/cli.mjs <serverA_entry> <serverB_entry> <scenario.json> [extraServerArg ...]
import { compare } from "./diff.mjs";
const [a,b,scen,...extra] = process.argv.slice(2);
if(!a||!b||!scen){ console.error("usage: cli.mjs <entryA> <entryB> <scenario.json> [serverArgs...]"); process.exit(2); }
const r = compare(a,b,scen,extra);
console.log(JSON.stringify(r,null,2));
console.error(`\n== SUMMARY (${scen}, N=${r.runs}) ==`);
console.error(`primary behavioural-change alerts: ${r.primary_alerts.length}`);
console.error(`intermittent (retained for review): ${r.evidence_intermittent.length}`);
console.error(`suppressed as nondeterministic noise: ${r.suppressed_noise.length}`);
for(const p of r.primary_alerts) console.error(`  ALERT ${p.field}: ${p.v1} -> ${p.v2}  [observed_source=${p.observed_source}]`);
