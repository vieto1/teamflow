const base=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const auth={apikey:secret,Authorization:`Bearer ${secret}`};
const allowed=new Set(['https://vieto1.github.io','http://localhost:3000','http://127.0.0.1:3000']);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const types:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
class ApiError extends Error{constructor(message:string,public status=400){super(message)}}
async function api(path:string,init:RequestInit={}){const r=await fetch(base+path,{...init,headers:{...auth,'Content-Type':'application/json',...init.headers}});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=null}if(!r.ok){const msg=data?.message||data?.error||'';if(msg.includes('TILE_LIMIT'))throw new ApiError('Das Board enthält bereits 50 Kacheln.',409);if(msg.includes('STORAGE_LIMIT'))throw new ApiError('Die Board-Grenze von 200 Dateien oder 250 MB ist erreicht. Auch der Papierkorb zählt dazu.',409);if(msg.includes('TILE_MISSING'))throw new ApiError('Diese Kachel wurde entfernt. Bitte aktualisieren.',409);throw new ApiError('Die Dateiablage ist vorübergehend nicht erreichbar.',503)}return data}
const db=(path:string,init:RequestInit={})=>api('/rest/v1/'+path,init);
async function limitedBody(req:Request,max:number){if(Number(req.headers.get('content-length')||0)>max)throw new ApiError('Die Datei darf maximal 10 MB groß sein.',413);const reader=req.body?.getReader();if(!reader)throw new ApiError('Leere Anfrage.');let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError('Die Datei darf maximal 10 MB groß sein.',413)}chunks.push(value)}const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length}return result}
function validContent(ext:string,b:Uint8Array){const text=new TextDecoder().decode(b.slice(0,16));if(ext==='pdf')return text.startsWith('%PDF-');if(ext==='png')return b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;if(['jpg','jpeg'].includes(ext))return b[0]===255&&b[1]===216&&b[2]===255;if(ext==='webp')return text.startsWith('RIFF')&&text.slice(8,12)==='WEBP';if(['docx','xlsx','pptx'].includes(ext))return b[0]===80&&b[1]===75&&b[2]===3&&b[3]===4;try{new TextDecoder('utf-8',{fatal:true}).decode(b);return !b.includes(0)}catch{return false}}
function tileValues(body:Record<string,unknown>){if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>80||typeof body.description!=='string'||body.description.length>250||!['Viet','Do Hai','Can','John'].includes(String(body.author))||!['blue','purple','mint','amber','rose','slate'].includes(String(body.color)))throw new ApiError('Bitte Titel, Teammitglied und Farbe prüfen.');return {title:body.title.trim(),description:body.description.trim(),author:body.author,color:body.color}}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};if(origin&&allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed.has(origin))return respond({error:'Origin not allowed'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(req.method==='GET'){
   const [tiles,files]=await Promise.all([db('teamflow_board_tiles?select=*&order=created_at.desc'),db('teamflow_board_files?ready=eq.true&select=*&order=created_at.desc')]);
   const visible=files.filter((f:{archived:boolean;tile_id:string})=>!f.archived&&tiles.some((t:{id:string;archived:boolean})=>t.id===f.tile_id&&!t.archived));
   const signed=visible.length?await api('/storage/v1/object/sign/teamflow-board',{method:'POST',body:JSON.stringify({paths:visible.map((f:{path:string})=>f.path),expiresIn:3600})}):[];
   const urls=new Map(signed.map((s:{path:string;signedURL?:string;signedUrl?:string})=>[s.path,s.signedURL||s.signedUrl]));
   return respond({tiles,files:files.map((f:{path:string;name:string})=>{const path=urls.get(f.path);return {...f,url:path?(String(path).startsWith('http')?path:base+'/storage/v1'+path):null}}),limits:{fileBytes:10485760,totalBytes:262144000,files:200,tiles:50}});
  }
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
   const bytes=await limitedBody(req,10485760+65536);const form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();const file=form.get('file'),tileId=form.get('tileId');
   if(!(file instanceof File)||!uuid(tileId))throw new ApiError('Bitte Datei und Kachel auswählen.');if(!file.size||file.size>10485760)throw new ApiError('Dateien müssen zwischen 1 Byte und 10 MB groß sein.',413);
   const name=file.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,180);const ext=name.split('.').pop()?.toLowerCase()||'',mime=types[ext];if(!mime)throw new ApiError('Erlaubt: PDF, JPG, PNG, WebP, DOCX, XLSX, PPTX, TXT und CSV.');
   const data=new Uint8Array(await file.arrayBuffer());if(!validContent(ext,data))throw new ApiError('Dateiinhalt und Dateityp passen nicht zusammen.');
   const id=crypto.randomUUID(),path=`${tileId}/${id}.${ext}`;
   await db('rpc/teamflow_board_reserve',{method:'POST',body:JSON.stringify({p_id:id,p_tile_id:tileId,p_name:name,p_path:path,p_size:file.size,p_mime:mime})});
   try{
    await api('/storage/v1/object/teamflow-board/'+path,{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false'},body:data});
    await db(`teamflow_board_files?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({ready:true})});
   }catch(e){let cleaned=false;try{await api('/storage/v1/object/teamflow-board',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});cleaned=true}catch{}if(cleaned)await db(`teamflow_board_files?id=eq.${id}`,{method:'DELETE'}).catch(()=>{});throw e}
   return respond({id},201);
  }
  const bytes=await limitedBody(req,4096);let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{throw new ApiError('Ungültige Anfrage.')}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError('Ungültige Anfrage.');
  if(body.action==='createTile'){const value=tileValues(body);const tile=await db('rpc/teamflow_board_create',{method:'POST',body:JSON.stringify({p_id:crypto.randomUUID(),p_title:value.title,p_description:value.description,p_author:value.author,p_color:value.color})});return respond({tile:tile[0]},201)}
  if(!uuid(body.id))throw new ApiError('Ungültiger Eintrag.');
  if(body.action==='editTile'){const value=tileValues(body);if(typeof body.updated_at!=='string')throw new ApiError('Bitte Kachel neu laden.');const rows=await db(`teamflow_board_tiles?id=eq.${body.id}&updated_at=eq.${encodeURIComponent(body.updated_at)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...value,updated_at:new Date().toISOString()})});if(!rows.length)throw new ApiError('Die Kachel wurde inzwischen geändert. Bitte aktualisieren und erneut bearbeiten.',409);return respond({ok:true})}
  const actions:Record<string,[string,boolean]>={archiveTile:['teamflow_board_tiles',true],restoreTile:['teamflow_board_tiles',false],archiveFile:['teamflow_board_files',true],restoreFile:['teamflow_board_files',false]};const action=actions[body.action];if(!action)throw new ApiError('Unbekannte Aktion.');await db(`${action[0]}?id=eq.${body.id}`,{method:'PATCH',body:JSON.stringify({archived:action[1],...(action[0]==='teamflow_board_tiles'?{updated_at:new Date().toISOString()}:{})})});return respond({ok:true});
 }catch(e){return respond({error:e instanceof ApiError?e.message:'Die Dateiablage ist vorübergehend nicht erreichbar.'},e instanceof ApiError?e.status:503)}
});
