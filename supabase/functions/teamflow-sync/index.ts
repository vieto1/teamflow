import {applyOperations,validOperations,SyncConflict,same,type Snapshot} from './core.ts';
const allowed=new Set(['https://vieto1.github.io','http://localhost:3000','http://127.0.0.1:3000']);
const base=Deno.env.get('SUPABASE_URL')!;const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const dbHeaders={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
async function db(path:string,init:RequestInit={}){const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers:{...dbHeaders,...init.headers}});if(!r.ok)throw new Error('Database unavailable');return r.status===204?null:await r.json()}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'content-type,x-teamflow-key,apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Max-Age':'600'};if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed.has(origin))return respond({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(!['GET','POST'].includes(req.method))return respond({error:'Method not allowed'},405);
 try{
  const key=req.headers.get('x-teamflow-key')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(key))return respond({error:'Teamzugang erforderlich.'},401);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const access=await db(`teamflow_access_keys?key_hash=eq.${hash}&enabled=eq.true&select=workspace_id&limit=1`);if(!access?.length)return respond({error:'Teamlink ist ungültig oder wurde widerrufen.'},401);
  const read=async()=>{const rows=await db('teamflow_workspace?id=eq.teamflow&select=revision,data,updated_at');if(!rows?.length)throw Error('Missing workspace');return rows[0] as Snapshot};
  if(req.method==='GET')return respond(await read());
  if(Number(req.headers.get('content-length')||0)>1000000)return respond({error:'Änderung ist zu groß.'},413);
  const text=await req.text();if(text.length>1000000)return respond({error:'Änderung ist zu groß.'},413);let body;try{body=JSON.parse(text)}catch{return respond({error:'Ungültige Anfrage.'},400)}
  if(!validOperations(body.operations))return respond({error:'Ungültige Änderungen.'},400);
  for(let attempt=0;attempt<4;attempt++){
   const snapshot=await read();let data;
   try{data=applyOperations(snapshot.data,body.operations)}catch(e){if(e instanceof SyncConflict)return respond({error:e.message,fields:e.fields,snapshot},409);throw e}
   data.meetings=data.meetings.map(m=>m.videoRoom?m:{...m,videoRoom:'teamflow-'+crypto.randomUUID()});
   if(data.meetings.length+data.todos.length>5000||JSON.stringify(data).length>4000000)return respond({error:'Teamdaten überschreiten die erlaubte Größe.'},413);
   if(same(data,snapshot.data))return respond(snapshot);
   const changed=await db(`teamflow_workspace?id=eq.teamflow&revision=eq.${snapshot.revision}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data,revision:snapshot.revision+1,updated_at:new Date().toISOString()})});if(changed?.length)return respond(changed[0]);
  }
  return respond({error:'Gleichzeitige Änderungen. Bitte erneut versuchen.'},503);
 }catch{return respond({error:'Synchronisierung vorübergehend nicht erreichbar.'},503)}
});
