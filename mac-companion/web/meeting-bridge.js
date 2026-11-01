'use strict';
// Only an explicitly paired opener can hand audio to this local session.
const bridgeArgs=new URLSearchParams(location.hash.slice(1));
const bridgeNonce=bridgeArgs.get('bridge')||'';
const bridgeOpener=window.opener;
const TEAMFLOW_ORIGIN='https://vieto1.github.io';
let bridgePaired=false,bridgeBusy=false;
function bridgeAllowed(event){return bridgePaired&&event.origin===TEAMFLOW_ORIGIN&&event.source===bridgeOpener&&event.data?.nonce===bridgeNonce}
function bridgeSend(type,data={}){if(bridgeOpener&&!bridgeOpener.closed)bridgeOpener.postMessage({type,nonce:bridgeNonce,...data},TEAMFLOW_ORIGIN)}
if(bridgeOpener&&/^[0-9a-f-]{36}$/.test(bridgeNonce)){
 history.replaceState(null,'','/');
 $('meeting-bridge').hidden=false;
 $('bridge-title').textContent=bridgeArgs.get('title')||'Teamflow-Meeting';
 $('meeting-title').value=(bridgeArgs.get('title')||'Teamflow-Meeting').slice(0,200);
 const date=bridgeArgs.get('date')||'';if(/^\d{4}-\d{2}-\d{2}$/.test(date))$('meeting-date').value=date;
 $('bridge-connect').addEventListener('click',()=>{if(!$('consent').checked){$('bridge-state').textContent='Die Gruppenfreigabe ist in den Aufnahmeeinstellungen deaktiviert.';return}bridgePaired=true;$('bridge-connect').disabled=true;$('bridge-connect').textContent='Mit Meeting verbunden';$('bridge-state').textContent='Zurück im Teamflow-Meeting auf „Aufnahme starten“ klicken. Dieses Fenster geöffnet lassen.';bridgeSend('teamflow:ready')});
}
window.addEventListener('message',async event=>{
 if(!bridgeAllowed(event))return;
 const data=event.data;
 if(data.type==='teamflow:ping'){bridgeSend('teamflow:ready');return}
 if(data.type==='teamflow:recording'){$('bridge-state').textContent='● Aufnahme läuft im Teamflow-Meeting. Der Gesprächston wird dort erfasst.';return}
 if(data.type!=='teamflow:audio'||bridgeBusy)return;
 try{
  if(!(data.blob instanceof Blob)||!data.blob.size||data.blob.size>512*1024*1024)throw Error('Ungültige oder zu große Aufnahme.');
  if(!$('consent').checked)throw Error('Die Gruppenfreigabe ist auf diesem Mac deaktiviert. Bitte Aufnahmeeinstellungen prüfen.');
  const title=String(data.meeting?.title||'Meeting').slice(0,200),date=String(data.meeting?.date||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Meetingdatum fehlt.');
  bridgeBusy=true;$('bridge-state').textContent='Aufnahme empfangen. Transkription auf dem Mac startet …';
  const file=new File([data.blob],data.blob.type.includes('mp4')?'Meeting.m4a':'Meeting.webm',{type:data.blob.type});
  const query=new URLSearchParams({title,date,name:file.name,consent:'1'});
  const job=await rawUpload('/api/jobs/audio?'+query,file);await jobs();
  const track=async()=>{try{const list=await request('/api/jobs'),currentJob=list.find(x=>x.id===job.id);if(!currentJob)throw Error('Protokoll wurde entfernt.');$('bridge-state').textContent=currentJob.stage;bridgeSend('teamflow:progress',{stage:currentJob.stage});
   if(currentJob.status==='failed')throw Error(currentJob.error||'Analyse fehlgeschlagen.');
   if(currentJob.status==='done'){const result=await request(`/api/jobs/${job.id}/result`);bridgeSend('teamflow:result',{result:{...result,sourceMeetingId:String(data.meeting?.id||'')}});$('bridge-state').textContent='Fertig. Ergebnisse wurden an KI-Protokoll in deinem Teamflow-Fenster übergeben. Noch nichts öffentlich gespeichert.';bridgeBusy=false;await openReview(job.id);return}
   setTimeout(()=>void track(),2000);
  }catch(error){bridgeBusy=false;$('bridge-state').textContent=error.message;bridgeSend('teamflow:error',{error:error.message})}};
  await track();
 }catch(error){bridgeBusy=false;$('bridge-state').textContent=error.message;bridgeSend('teamflow:error',{error:error.message})}
});
