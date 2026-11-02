const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
(async()=>{
 let cursor=0,reloads=0,messages=0;const slots=[],effects=[],pending=[],timeouts=[],win={},sw={};
 const useState=v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]};
 const useRef=v=>{const i=cursor++;return slots[i]??(slots[i]={current:v})};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!effects[i]||deps.some((v,j)=>!Object.is(v,effects[i].deps[j])))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})};
 const registration={waiting:{postMessage(){messages++}},addEventListener(){},update:async()=>{}};
 const ctx={exports:{},require:n=>n==='react'?{useState,useRef,useEffect}:n==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:{},process:{env:{NEXT_PUBLIC_TEAMFLOW_VERSION:'old'}},
 navigator:{onLine:true,userAgent:'Desktop',platform:'Desktop',maxTouchPoints:0,serviceWorker:{register:async()=>registration,addEventListener:(n,f)=>sw[n]=f,removeEventListener(){},controller:{}}},
 window:{matchMedia:()=>({matches:false}),location:{pathname:'/teamflow/',reload:()=>reloads++},addEventListener:(n,f)=>win[n]=f,removeEventListener(){}},
 document:{visibilityState:'visible',documentElement:{dataset:{},classList:{toggle(){}}},addEventListener(){},removeEventListener(){}},fetch:async()=>({ok:true,json:async()=>({version:'new'})}),setInterval:()=>1,clearInterval(){},setTimeout:fn=>timeouts.push(fn)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/pwa-client.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,ctx);
 async function render(){cursor=0;pending.length=0;const tree=ctx.exports.default();pending.splice(0).forEach(f=>f());await new Promise(setImmediate);return tree}
 function find(tree){if(Array.isArray(tree)){for(const item of tree){const f=find(item);if(f)return f}}else if(tree&&typeof tree==='object'){if(tree.type==='button'&&String(tree.props.children).includes('aktualisieren'))return tree;return find(tree.props?.children)}}
 await render();let button=find(await render());assert(button);
 ctx.document.documentElement.dataset.teamflowCallActive='true';win['teamflow:call-state']();button=find(await render());assert.equal(button.props.disabled,true);button.props.onClick();assert.equal(messages,0);assert.equal(reloads,0);
 delete ctx.document.documentElement.dataset.teamflowCallActive;win['teamflow:call-state']();button=find(await render());button.props.onClick();assert.equal(messages,1);
 ctx.document.documentElement.dataset.teamflowCallActive='true';sw.controllerchange();timeouts.forEach(fn=>fn());assert.equal(reloads,0,'Call starting during an update must also prevent delayed/controller reloads');
 delete ctx.document.documentElement.dataset.teamflowCallActive;win['teamflow:call-state']();button=find(await render());button.props.onClick();sw.controllerchange();assert.equal(reloads,1,'Updates work after the meeting');
 effects.forEach(e=>e?.cleanup?.());console.log('PWA call guard checks passed: active-call update block, update-start race, safe update after call.');
})().catch(e=>{console.error(e);process.exit(1)});
