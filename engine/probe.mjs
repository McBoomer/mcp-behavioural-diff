import { execFileSync } from "node:child_process"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url));
const mock = fs.readFileSync(path.join(dir,".mockport"),"utf8").trim();
const cap="/tmp/probe.jsonl"; try{fs.rmSync(cap)}catch(e){}
execFileSync("node",[path.join(dir,"probe.cjs")],{env:{...process.env,NODE_OPTIONS:"--require "+path.join(dir,"shim.cjs"),CAP_OUT:cap,MOCK_PORT:mock},timeout:8000});
const L=fs.readFileSync(cap,"utf8").trim().split("\n").map(x=>JSON.parse(x));
const have=(layer,host)=>L.some(l=>l.layer===layer&&(!host||l.host===host));
const checks=[["https.request body","https.request","probe.https.test"],["fetch body","fetch","probe.fetch.test"],["child_process (command only)","child_process.spawn",null],["net.connect (dest only)","net.connect","probe.raw.test"]];
let ok=true; for(const [name,layer,host] of checks){ const p=have(layer,host); console.log((p?"PASS":"FAIL")+"  "+name); ok=ok&&p; }
process.exit(ok?0:1);
