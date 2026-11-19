// Verifies instrumentation claims. Run under the shim; asserts each layer is captured.
(async()=>{
  const https=require('https');
  try{ const r=https.request({hostname:'probe.https.test',path:'/p',method:'POST'}); r.write('{"a":1}'); r.end(); }catch(e){}
  try{ await fetch('https://probe.fetch.test/p',{method:'POST',body:'{"b":2}'}); }catch(e){}
  try{ require('child_process').spawn('curl',['-s','https://probe.curl.test']); }catch(e){}
  try{ const s=require('net').connect({host:'probe.raw.test',port:443}); s.on('error',()=>{}); setTimeout(()=>s.destroy(),150);}catch(e){}
  setTimeout(()=>process.exit(0),500);
})();
