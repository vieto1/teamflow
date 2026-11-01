const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const listeners={},elements=new Map(),messages=[],opener={closed:false,postMessage:(data,origin)=>messages.push({data,origin})};let uploads=0;
 const get=id=>{if(!elements.has(id))elements.set(id,{checked:true,addEventListener:(name,fn)=>listeners[id+':'+name]=fn});return elements.get(id)};
 const nonce='10000000-0000-4000-8000-000000000001',job='20000000-0000-4000-8000-000000000001';
 const context={URLSearchParams,Blob,File,setTimeout:()=>{},location:{hash:'#bridge='+nonce+'&title=Test&date=2026-11-01'},history:{replaceState:()=>{}},window:{opener,addEventListener:(name,fn)=>listeners[name]=fn},$:get,request:async path=>path==='/api/jobs'?[{id:job,status:'done',stage:'Bereit'}]:{id:job},rawUpload:async()=>{uploads++;return {id:job}},jobs:async()=>{},openReview:async()=>{}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/web/meeting-bridge.js','utf8'),context);
 const data={type:'teamflow:audio',nonce,blob:new Blob(['audio']),meeting:{title:'Test',date:'2026-11-01'}};
 await listeners.message({origin:'https://vieto1.github.io',source:opener,data});assert.equal(uploads,0,'No automatic pairing');
 listeners['bridge-connect:click']();assert.equal(messages[0].data.type,'teamflow:ready');
 for(const event of [{origin:'https://evil.example',source:opener,data},{origin:'https://vieto1.github.io',source:{},data},{origin:'https://vieto1.github.io',source:opener,data:{...data,nonce:'wrong'}}])await listeners.message(event);
 assert.equal(uploads,0,'Reject wrong origin, source and nonce');
 await listeners.message({origin:'https://vieto1.github.io',source:opener,data});assert.equal(uploads,1);assert(messages.some(m=>m.data.type==='teamflow:result'));assert(messages.every(m=>m.origin==='https://vieto1.github.io'));
 console.log('Meeting bridge: pairing, origin/source/nonce validation, audio handoff and result return passed');
})().catch(e=>{console.error(e);process.exit(1)});
