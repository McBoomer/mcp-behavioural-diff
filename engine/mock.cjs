// Local mock API. Records nothing itself; just returns permissive JSON so
// the Postmark SDK and fetch paths accept the response and proceed.
const http = require('http');
const body = JSON.stringify({
  ID: 1, Name: "stub", MessageID: "stub-msg", ErrorCode: 0, Message: "OK",
  To: "stub", SubmittedAt: "2026-01-01T00:00:00Z",
  Color:"blue", ServerLink:"x", ApiTokens:[], InboundAddress:"x"
});
const srv = http.createServer((req,res)=>{
  let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
    res.writeHead(200,{'content-type':'application/json'}); res.end(body);
  });
});
srv.listen(0,'127.0.0.1',()=>{ console.log(srv.address().port); });
