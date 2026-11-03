const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert');
(async()=>{
 let slots=[],cursor=0,effects=[],tree,removed=[],kept=[],discarded=[];
 const id='11111111-1111-4111-8111-111111111111';const fixture={schema:'teamflow.local-ai.v1',id,meeting:{title:'Synthetischer Test',date:'2026-11-03'},summary:'Test',transcript:'Testgespräch.',keyPoints:[],decisions:[],todos:[],warnings:[]};
 const jsx=(type,props)=>({type,props:props||{}});
 const ctx={exports:{},require:n=>n==='react'?{useState:v=>{let i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef:v=>{let i=cursor++;return slots[i]??(slots[i]={current:v})},useEffect:(f,deps)=>{let i=cursor++;if(!slots[i]||deps.some((x,j)=>x!==slots[i][j])){slots[i]=deps;effects.push(f)}}}:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='./recording-store'?{keepProtocol:async(id,value)=>{kept=[value]},listKeptProtocols:async()=>kept,removeKeptProtocol:async id=>{removed.push(id);kept=kept.filter(x=>x.id!==id)}}:{},window:{confirm:()=>true},Date,Set,Array,Error};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/ai-protocol.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,ctx);
 const props={incoming:fixture,meetings:[],todos:[],onPublish(){},onDiscard:async id=>{discarded.push(id);return true}};
 async function render(){cursor=0;tree=ctx.exports.default(props);const batch=effects;effects=[];for(const f of batch)f();await new Promise(r=>setImmediate(r))}
 function all(node){return !node?[]:Array.isArray(node)?node.flatMap(all):typeof node==='object'?[node,...all(node.props?.children)]:[]}
 function button(label){return all(tree).find(n=>n.type==='button'&&n.props.children===label)}
 await render();await render();assert(button('Protokoll behalten'));assert(button('Verwerfen / löschen'));await button('Protokoll behalten').props.onClick();await new Promise(r=>setImmediate(r));await render();assert.equal(kept[0].id,id);assert.equal(kept[0].schema,'teamflow.local-ai.v1');assert.equal(removed.length,0);await button('Verwerfen / löschen').props.onClick();await new Promise(r=>setImmediate(r));await render();assert.equal(discarded[0],id);assert.equal(removed[0],id);assert.equal(kept.length,0);assert(!button('Protokoll behalten'));
 assert(!fs.readFileSync('src/app/ai-protocol.tsx','utf8').includes('Alternative: vorhandene lokale KI verwenden'));assert(!fs.readFileSync('src/app/ai-protocol.tsx','utf8').includes('Euer KI-Protokoll. Direkt aus dem Meeting.'));
 console.log('Protocol retention: edited snapshot kept separately, explicit discard clears recovery and archive, explanatory blocks removed.');
})().catch(e=>{console.error(e);process.exit(1)});
