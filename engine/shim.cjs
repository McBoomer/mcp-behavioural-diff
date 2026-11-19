'use strict';
const fs = require('fs');
const CAP = process.env.CAP_OUT;
const MOCK_PORT = parseInt(process.env.MOCK_PORT, 10);
function rec(ev){ try{ fs.appendFileSync(CAP, JSON.stringify(ev)+'\n'); }catch(e){} }
function lc(h){try{const o={};for(const k in (h||{}))o[String(k).toLowerCase()]=h[k];return o;}catch(e){return h;}}
function bodyToString(b){ try{ if(b==null) return null; if(typeof b==='string') return b; if(Buffer.isBuffer(b)) return b.toString('utf8'); if(b instanceof Uint8Array) return Buffer.from(b).toString('utf8'); return '[unreadable:'+(b&&b.constructor&&b.constructor.name)+']'; }catch(e){ return '[err]'; } }

const http = require('http');
const https = require('https');
const ORIG_HTTP_REQUEST = http.request.bind(http);   // saved BEFORE wrapping

function makeWrapper(proto){
  return function(a,b,c){
    let opts, cb;
    if(typeof a==='string'||a instanceof URL){ const u = typeof a==='string'?new URL(a):a; if(typeof b==='function'){ opts=u; cb=b; } else { opts=Object.assign({}, b, {__url:u}); cb=c; } }
    else { opts=a; cb=b; }
    let host,port,path,method,headers;
    try{
      if(opts instanceof URL){ host=opts.hostname; port=opts.port||(proto==='https'?443:80); path=opts.pathname+opts.search; method='GET'; headers={}; }
      else if(opts.__url){ const u=opts.__url; host=u.hostname; port=u.port||(proto==='https'?443:80); path=u.pathname+u.search; method=(opts.method||'GET').toUpperCase(); headers=Object.assign({},opts.headers); }
      else { host=opts.hostname||opts.host||'localhost'; port=opts.port||(proto==='https'?443:80); path=opts.path||'/'; method=(opts.method||'GET').toUpperCase(); headers=Object.assign({},opts.headers); }
    }catch(e){ host='?'; port='?'; path='?'; method='?'; headers={}; }
    const newOpts = { hostname:'127.0.0.1', host:'127.0.0.1', port:MOCK_PORT, protocol:'http:', method, path, headers:Object.assign({},headers) };
    const req = ORIG_HTTP_REQUEST(newOpts, cb);   // original -> no recursion
    let buf=[];
    const ow=req.write.bind(req), oe=req.end.bind(req);
    req.write=function(ch,enc,cbk){ if(ch) buf.push(Buffer.isBuffer(ch)?ch:Buffer.from(ch,typeof enc==='string'?enc:'utf8')); return ow(ch,enc,cbk); };
    req.end=function(ch,enc,cbk){ if(ch&&typeof ch!=='function') buf.push(Buffer.isBuffer(ch)?ch:Buffer.from(ch,typeof enc==='string'?enc:'utf8')); rec({layer:proto+'.request',method,host,port:String(port),path,headers:lc(headers),body:bodyToString(Buffer.concat(buf))}); return oe(ch,enc,cbk); };
    return req;
  };
}
http.request = makeWrapper('http');
https.request = makeWrapper('https');
http.get = function(a,b,c){ const r=http.request(a,b,c); r.end(); return r; };
https.get = function(a,b,c){ const r=https.request(a,b,c); r.end(); return r; };

if(typeof globalThis.fetch==='function'){
  const of = globalThis.fetch;
  globalThis.fetch = async function(input, init){
    try{
      let url = typeof input==='string'?input:(input&&input.url)||String(input);
      const u = new URL(url);
      const method=(init&&init.method)||(input&&input.method)||'GET';
      const headers={}; try{ const h=(init&&init.headers)||(input&&input.headers); if(h){ if(typeof h.forEach==='function') h.forEach((v,k)=>headers[k]=v); else Object.assign(headers,h);} }catch(e){}
      const body=init&&init.body!=null?bodyToString(init.body):null;
      rec({layer:'fetch',method:String(method).toUpperCase(),host:u.hostname,port:String(u.port||(u.protocol==='https:'?443:80)),path:u.pathname+u.search,headers,body});
      return of('http://127.0.0.1:'+MOCK_PORT+u.pathname+u.search, init);
    }catch(e){ rec({layer:'fetch',error:String(e)}); return of(input,init); }
  };
}

const net=require('net');
const OC=net.connect;
function netwrap(...args){ try{ const o=args[0]; if(o&&typeof o==='object'&&o.host&&o.port&&o.host!=='127.0.0.1') rec({layer:'net.connect',host:String(o.host),port:String(o.port),capture:'destination_only_partial'});}catch(e){} return OC.apply(net,args); }
net.connect=netwrap; net.createConnection=netwrap;

try{ const cp=require('child_process'); for(const f of ['spawn','exec','execFile','spawnSync','execSync','execFileSync']){ const o=cp[f]; if(o) cp[f]=function(...a){ rec({layer:'child_process.'+f,cmd:String(a[0]),capture:'command_only_partial'}); return o.apply(cp,a); }; } }catch(e){}
try{ for(const f of ['writeFile','writeFileSync','appendFile','appendFileSync']){ const o=fs[f]; if(o) fs[f]=function(...a){ try{ const p=String(a[0]); if(p!==CAP) rec({layer:'fs.'+f,path:p}); }catch(e){} return o.apply(fs,a); }; } }catch(e){}
try{ const dns=require('dns'); const ol=dns.lookup; if(ol) dns.lookup=function(h,...r){ rec({layer:'dns.lookup',host:String(h)}); return ol.call(dns,h,...r); }; }catch(e){}
rec({layer:'_shim_loaded'});
