const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
(async()=>{
 const handlers={},sent=[],cleanups=[],made=[];let received=null,hasTabAudio=true;
 const popup={closed:false,postMessage:(data,origin)=>sent.push({data,origin})};
 const track=()=>({enabled:true,stop(){this.stopped=true},addEventListener(){}});
 const sharedAudio=track(),video=track(),mic=track();
 class Stream{constructor(tracks){this.tracks=tracks||[]}getTracks(){return this.tracks}getAudioTracks(){return this.tracks}}
 const shared={getTracks:()=>[video,...(hasTabAudio?[sharedAudio]:[])],getAudioTracks:()=>hasTabAudio?[sharedAudio]:[],getVideoTracks:()=>[video]};
 class Recorder{static isTypeSupported(){return true}constructor(){this.state='inactive';this.mimeType='audio/webm';made.push(this)}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['recorded sound'])});this.onstop()}}
 class Audio{async resume(){}async close(){}createMediaStreamDestination(){return {stream:new Stream()}}createMediaStreamSource(){return {connect(){}}}}
 const context={exports:{},require:n=>n==='react'?{useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:fn=>cleanups.push(fn())}:n==='./ai-protocol'?{parseLocalProtocol:v=>v}:{},crypto:require('crypto').webcrypto,window:{open:()=>popup,MediaRecorder:Recorder,addEventListener:(n,fn)=>handlers[n]=fn,removeEventListener(){}},navigator:{mediaDevices:{getDisplayMedia:async()=>shared,getUserMedia:async()=>new Stream([mic])}},MediaRecorder:Recorder,MediaStream:Stream,AudioContext:Audio,Blob,URL,URLSearchParams,Date,setTimeout:()=>{},setInterval:()=>1,clearInterval(){},document:{createElement:()=>({click(){}})}};
 const compiled=ts.transpileModule(fs.readFileSync('src/app/meeting-recorder.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(compiled,context);const c=context.exports.useMeetingRecorder(v=>{received=v});
 c.connect({id:'meeting-1',title:'Test',date:'2026-11-01'});
 await handlers.message({origin:'https://evil.example',source:popup,data:{type:'teamflow:ready'}});await c.start();assert.equal(made.length,0);
 // Capture URL from a fresh bridge connection.
 let opened;context.window.open=url=>{opened=url;return popup};c.connect({id:'meeting-1',title:'Test',date:'2026-11-01'});const key=new URLSearchParams(new URL(opened).hash.slice(1)).get('bridge');
 await handlers.message({origin:'http://127.0.0.1:8765',source:popup,data:{type:'teamflow:ready',nonce:key}});
 c.setMicrophoneMuted(false);await c.start();assert.equal(made.length,1);assert.equal(made[0].state,'recording');assert.equal(mic.enabled,true);
 c.setMicrophoneMuted(true);assert.equal(mic.enabled,false);
 c.finishMeeting();assert(sent.some(m=>m.data.type==='teamflow:audio'&&m.data.blob.size>0));assert(sent.every(m=>m.origin==='http://127.0.0.1:8765'));
 await handlers.message({origin:'http://127.0.0.1:8765',source:popup,data:{type:'teamflow:result',nonce:'wrong',result:{id:'test'}}});assert.equal(received,null);
 await handlers.message({origin:'http://127.0.0.1:8765',source:popup,data:{type:'teamflow:result',nonce:key,result:{id:'test'}}});assert.equal(received.id,'test');
 c.connect({id:'meeting-1',title:'Test',date:'2026-11-01'});const key2=new URLSearchParams(new URL(opened).hash.slice(1)).get('bridge');await handlers.message({origin:'http://127.0.0.1:8765',source:popup,data:{type:'teamflow:ready',nonce:key2}});hasTabAudio=false;await c.start();assert.equal(made.length,1,'No recording without shared conversation audio');
 // Native bridge: one click, confirmed start, mute and result routing without a popup.
 cleanups.forEach(fn=>fn?.());cleanups.length=0;sent.length=0;received=null;
 context.window.__TEAMFLOW_NATIVE__={version:'1.3.0'};
 context.window.webkit={messageHandlers:{teamflowRecorder:{postMessage:data=>sent.push(data)}}};
 const native=context.exports.useMeetingRecorder(v=>{received=v});
 assert(sent.some(m=>m.command==='status'));
 native.startNative({id:'native-1',title:'Native test',date:'2026-11-02'});
 native.startNative({id:'native-1',title:'Native test',date:'2026-11-02'});
 assert.equal(sent.filter(m=>m.command==='start').length,1,'Avoid duplicate native starts');
 native.setMicrophoneMuted(false);
 handlers['teamflow:native']({detail:{type:'started',startedAt:Date.now()}});
 assert(sent.some(m=>m.command==='mute'&&m.muted===false));
 native.finishMeeting();assert(sent.some(m=>m.command==='stop'));
 handlers['teamflow:native']({detail:{type:'processing',stage:'Transkribiert'}});
 native.startNative({id:'native-2',title:'Busy',date:'2026-11-02'});
 assert.equal(sent.filter(m=>m.command==='start').length,1,'No second recording during processing');
 handlers['teamflow:native']({detail:{type:'result',result:{id:'native-result'}}});assert.equal(received.id,'native-result');
 cleanups.forEach(fn=>fn?.());console.log('Recorder controller: guarded handshake, start/stop, mute, audio transfer, result routing and missing-tab-audio checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
