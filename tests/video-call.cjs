const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
(async()=>{
 const source=fs.readFileSync('src/app/page.tsx','utf8');
 const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const declaration=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='VideoCall');
 const compiled=ts.transpileModule(declaration.getText(ast)+'\nexports.VideoCall=VideoCall;',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 let cursor=0,queue=[],created=[],closed=0,stopped=0,mutes=[];const slots=[],effects=[],handlers={};
 function useState(value){const index=cursor++;if(!(index in slots))slots[index]=value;return[slots[index],v=>{slots[index]=typeof v==='function'?v(slots[index]):v}];}
 function useRef(value){const index=cursor++;if(!(index in slots))slots[index]={current:index===2?{}:value};return slots[index];}
 function useEffect(fn,deps){const index=cursor++,old=effects[index];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i])))queue.push(()=>{old?.cleanup?.();effects[index]={deps,cleanup:fn()}});}
 class Jitsi{constructor(domain,options){this.domain=domain;this.options=options;this.events={};this.disposals=0;created.push(this)}addListener(name,fn){this.events[name]=fn}getIFrame(){return{title:'',getAttribute(){return''},setAttribute(){}}}dispose(){this.disposals++}executeCommand(){}}
 const ctx={exports:{},useState,useRef,useEffect,Date,Number,JSON,Event,AbortController,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,
 require:n=>n==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:{},
 window:{JitsiMeetExternalAPI:Jitsi,addEventListener:(n,fn)=>handlers[n]=fn,removeEventListener:n=>delete handlers[n],dispatchEvent(){}},document:{documentElement:{dataset:{}}},
 Icon:()=>null,RecordingControls:()=>null,loadJitsiScript:async()=>{},requestJaasAccess:async()=>({appId:'vpaas-magic-cookie-test',jwt:'test-room-jwt'}),invitationUrl:r=>'https://teamflow.test/?room='+r};
 vm.runInNewContext(compiled,ctx);
 const meeting={id:'one',title:'Test',videoRoom:'teamflow-12345678901234567890',date:'2026-11-02'};
 const controller=()=>({phase:'ready',elapsed:0,setMicrophoneMuted:v=>mutes.push(v),finishMeeting:()=>stopped++});
 async function render(m=meeting){cursor=0;queue=[];const tree=ctx.exports.VideoCall({meeting:m,onClose:()=>closed++,controller:controller()});queue.forEach(fn=>fn());await new Promise(setImmediate);return tree;}
 function visit(tree,predicate){if(!tree)return;if(Array.isArray(tree)){for(const n of tree){const found=visit(n,predicate);if(found)return found}}else if(typeof tree==='object'){if(predicate(tree))return tree;return visit(tree.props?.children,predicate)}}
 let tree=await render();assert.equal(created.length,1,'JaaS meeting starts directly');assert.equal(created[0].domain,'8x8.vc');assert.equal(created[0].options.jwt,'test-room-jwt');assert.equal(created[0].options.roomName,'vpaas-magic-cookie-test/'+meeting.videoRoom);assert.equal(ctx.document.documentElement.dataset.teamflowCallActive,'true');
 created[0].events.videoConferenceJoined();await render();
 await render({...meeting,title:'Changed title',summary:'Synced notes'});assert.equal(created.length,1,'Metadata/controller rerenders must retain the same call');assert.equal(created[0].disposals,0);
 created[0].events.readyToClose();assert.equal(closed,0,'Unexpected provider close must not silently remove Teamflow');assert.equal(stopped,1,'Lost connection must stop recording');assert.equal(mutes.at(-1),true);
 tree=await render();assert(visit(tree,n=>n.props?.role==='alert'),'Disconnection must show an explanation and recovery');
 effects.forEach(e=>e?.cleanup?.());assert.equal(created[0].disposals,1);assert.equal(ctx.document.documentElement.dataset.teamflowCallActive,undefined);
 console.log('Video call regression checks passed: JaaS credentials, stable room, visible disconnect, recording cleanup, update lock lifecycle.');
})().catch(e=>{console.error(e);process.exit(1)});
