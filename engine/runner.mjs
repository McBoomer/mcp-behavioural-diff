import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dir = path.dirname(fileURLToPath(import.meta.url));
// args: entry capOut mockPort scenarioFile [extraServerArgs...]
const [entry, capOut, mockPort, scenarioFile, ...extra] = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(scenarioFile,"utf8"));
const env = { ...process.env, NODE_OPTIONS:"--require "+path.join(__dir,"shim.cjs"), CAP_OUT:capOut, MOCK_PORT:mockPort,
  POSTMARK_SERVER_TOKEN:"CANARY_TOKEN_11aa", DEFAULT_SENDER_EMAIL:"canary-sender@canary.test", DEFAULT_MESSAGE_STREAM:"canary-stream", POSTMARK_API_BASE:"https://api.postmarkapp.com" };
const t = new StdioClientTransport({ command:"node", args:[entry, ...extra], env, stderr:"ignore" });
const c = new Client({ name:"h", version:"1" }, { capabilities:{} });
const out = { tools:[], results:[] };
try{
  await c.connect(t);
  out.tools = (await c.listTools()).tools.map(x=>x.name);
  for(const step of scenario){
    try{ const r = await c.callTool({ name:step.tool, arguments:step.args });
      const txt = (r.content||[]).map(x=>x.type==="text"?x.text:("["+x.type+"]")).join("\n");
      out.results.push({ tool:step.tool, ok:!r.isError, text:txt.slice(0,2000) });
    }catch(e){ out.results.push({ tool:step.tool, error:String(e).slice(0,120) }); }
  }
}catch(e){ out.error=String(e).slice(0,200); }
finally{ try{await c.close()}catch(e){} try{t.close()}catch(e){} }
console.log(JSON.stringify(out));
process.exit(0);
