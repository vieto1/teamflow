// Public workspace by owner request. Only existing rooms; bounded device allocations.
const originAllowed='https://vieto1.github.io';
const enc=new TextEncoder();
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json64=(v:unknown)=>b64(enc.encode(JSON.stringify(v)));
function der(tag:number,data:Uint8Array){const n=data.length;const len=n<128?[n]:n<256?[129,n]:[130,n>>8,n&255];return new Uint8Array([tag,...len,...data])}
async function signingKey(){
 const pem=(Deno.env.get('JAAS_PRIVATE_KEY')||'').replace(/\\n/g,'\n').trim();
 if(!pem)throw Error('NOT_CONFIGURED');
 let bytes=Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 if(pem.includes('BEGIN RSA PRIVATE KEY'))bytes=der(48,new Uint8Array([2,1,0,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,...der(4,bytes)]));
 return crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'};
 if(origin===originAllowed)headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
 if(origin&&origin!==originAllowed)return reply({error:'Ursprung nicht erlaubt.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(req.method))return reply({error:'Methode nicht erlaubt.'},405);
 try{
  const app=Deno.env.get('JAAS_APP_ID')||'',kid=Deno.env.get('JAAS_KEY_ID')||'';
  if(!/^vpaas-magic-cookie-[a-f0-9]{32}$/.test(app)||!kid.startsWith(app+'/'))return reply({error:'JaaS-Zugang noch nicht eingerichtet.'},503);
  let key:CryptoKey;try{key=await signingKey()}catch{return reply({error:'JaaS-Schlüssel fehlt oder hat ein ungültiges Format.'},503)}
  if(req.method==='GET'){
   await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode('teamflow-key-check'));
   return reply({configured:true,provider:'jaas',appId:app,cloudRecording:false});
  }
  const raw=await req.text();if(raw.length>1024)return reply({error:'Anfrage zu groß.'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Ungültige Anfrage.'},400)}
  const {room,deviceId}=body;
  if(typeof room!=='string'||!/^teamflow-[a-zA-Z0-9-]{20,80}$/.test(room)||typeof deviceId!=='string'||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/.test(deviceId))return reply({error:'Ungültiger Raum oder Gerätezugang.'},400);
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const reservation=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/teamflow_reserve_video_device',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_device:deviceId,p_room:room})});
  if(!reservation.ok){const text=await reservation.text();if(text.includes('ROOM_NOT_FOUND'))return reply({error:'Meeting wird noch gespeichert. Bitte in einem Moment erneut versuchen.'},409);if(text.includes('LIMIT'))return reply({error:'Die kostenlose Gerätefreigabe ist ausgeschöpft. Es wird kein kostenpflichtiger Zugang aktiviert.'},429);return reply({error:'Meetingfreigabe derzeit nicht erreichbar.'},503)}
  const now=Math.floor(Date.now()/1000),expiresAt=now+4*60*60;
  const payload={aud:'jitsi',iss:'chat',sub:app,room,nbf:now-30,exp:expiresAt,context:{room:{regex:false},user:{id:deviceId,name:'Teamflow',moderator:'true'},features:{recording:false,transcription:false,livestreaming:false,'sip-inbound-call':false,'sip-outbound-call':false,'inbound-call':false,'outbound-call':false,'file-upload':false}}};
  const input=json64({alg:'RS256',typ:'JWT',kid})+'.'+json64(payload);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(input));
  return reply({jwt:input+'.'+b64(new Uint8Array(signature)),appId:app,expiresAt});
 }catch{return reply({error:'Videoraum konnte nicht freigegeben werden.'},503)}
});
