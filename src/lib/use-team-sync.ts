'use client';
import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {applyOperations,diffRecords,emptyWorkspace,validEntity,type Meeting,type Todo,type Workspace,type Snapshot,type Operation,type Collection} from './team-sync-core';
const ENDPOINT='https://bewbgijcyyckamhnomrd.supabase.co/functions/v1/teamflow-sync';
const KEY_STORAGE='teamflow-team-key';
type Status='locked'|'loading'|'online'|'saving'|'offline'|'conflict';
type Batch=Operation[];
function readJson(key:string){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
export function useTeamSync(){
 const [data,setData]=useState<Workspace>(emptyWorkspace);const [status,setStatus]=useState<Status>('locked');const [message,setMessage]=useState('');const [hydrated,setHydrated]=useState(false);const [authorized,setAuthorized]=useState(false);const [lastUpdated,setLastUpdated]=useState('');const [token,setToken]=useState('');const [pendingCount,setPendingCount]=useState(0);const [localCount,setLocalCount]=useState(0);
 const live=useRef<Workspace>(emptyWorkspace());const server=useRef<Snapshot>({revision:-1,data:emptyWorkspace()});const pending=useRef<Operation[]>([]);const busy=useRef(false);const connected=useRef(false);const conflicted=useRef(false);const keyRef=useRef('');const localImport=useRef<Workspace>(emptyWorkspace());const refreshRef=useRef<()=>Promise<void>>(async()=>{});const mounted=useRef(true);
 const draftKey=()=>`teamflow-pending-${keyRef.current.slice(-12)}`;
 const persist=()=>{try{localStorage.setItem(draftKey(),JSON.stringify(pending.current))}catch{setMessage('Der Browser kann keine Offline-Sicherung speichern. Bitte die Seite bis zum Speichern geöffnet lassen.')}};
 const publish=()=>{let next=server.current.data;try{next=applyOperations(next,pending.current,false)}catch{}live.current=next;if(mounted.current){setData(next);setPendingCount(pending.current.length)}};
 useEffect(()=>{mounted.current=true;try{const url=new URL(window.location.href);if(new URLSearchParams(url.hash.slice(1)).has('team')){url.hash='';window.history.replaceState(null,'',url)}
 const meetings=readJson('teamflow-meetings'),todos=readJson('teamflow-todos');localImport.current={meetings:Array.isArray(meetings)?meetings.filter((m):m is Meeting=>validEntity('meetings',m)):[],todos:Array.isArray(todos)?todos.filter((t):t is Todo=>validEntity('todos',t)):[]};setLocalCount(localImport.current.meetings.length+localImport.current.todos.length);
 }catch{}setToken('public-workspace');setHydrated(true);return()=>{mounted.current=false}},[]);

 useEffect(()=>{
  if(!token)return;keyRef.current=token;connected.current=false;conflicted.current=false;setStatus('loading');setMessage('');setAuthorized(false);server.current={revision:-1,data:emptyWorkspace()};pending.current=[];
  let previousKey='';try{previousKey=localStorage.getItem(KEY_STORAGE)||''}catch{}const saved=readJson(draftKey())??(previousKey?readJson(`teamflow-pending-${previousKey.slice(-12)}`):null);if(Array.isArray(saved))pending.current=saved;let cancelled=false;
  const request=async(operations?:Operation[])=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);try{const response=await fetch(ENDPOINT,{method:operations?'POST':'GET',cache:'no-store',headers:{...(operations?{'Content-Type':'application/json'}:{})},body:operations?JSON.stringify({operations}):undefined,signal:controller.signal});const payload=await response.json();return {response,payload}}finally{clearTimeout(timer)}};
  const refresh=async()=>{
   if(cancelled||busy.current||conflicted.current)return;if(!navigator.onLine){setStatus('offline');setMessage('Offline. Bitte verbinde dieses Gerät mit dem Internet.');return}busy.current=true;
   try{
    // Always load the latest snapshot before sending queued offline changes.
    const first=await request();if(cancelled)return;
    
    if(!first.response.ok)throw Error(first.payload.error||'Verbindung unterbrochen.');
    if(typeof first.payload.revision!=='number'||!first.payload.data)throw Error('Ungültiger Datenstand.');
    if(first.payload.revision>=server.current.revision)server.current=first.payload;
    connected.current=true;setAuthorized(true);publish();
    while(pending.current.length&&!cancelled){
     setStatus('saving');const batch:Batch=pending.current.slice(0,100);const sent=await request(batch);if(cancelled)return;
     if(sent.response.status===409){server.current=sent.payload.snapshot;conflicted.current=true;setStatus('conflict');setMessage('Ein Eintrag wurde gleichzeitig geändert. Deine Änderungen sind gesichert. Lade den aktuellen Teamstand und bearbeite den Eintrag erneut.');publish();return}
     
     if([400,413].includes(sent.response.status)){conflicted.current=true;setStatus('conflict');setMessage(sent.payload.error||'Eine lokale Änderung kann nicht gespeichert werden. Bitte Sicherung herunterladen und den Teamstand laden.');publish();return}if(!sent.response.ok)throw Error(sent.payload.error||'Speichern nicht möglich.');
     pending.current.splice(0,batch.length);server.current=sent.payload;persist();publish();
    }
    if(!cancelled){setStatus('online');setMessage('');setLastUpdated(new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));try{localStorage.setItem('teamflow-shared-cache',JSON.stringify(server.current))}catch{}}
   }catch(e){if(!cancelled){setStatus('offline');setMessage(e instanceof Error?e.message:'Verbindung unterbrochen.');persist()}}finally{busy.current=false}
  };
  refreshRef.current=refresh;void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},10000);
  const wake=()=>{if(document.visibilityState==='visible')void refresh()};const offline=()=>{setStatus('offline');setMessage('Offline. Änderungen werden lokal gesichert und später übertragen.')};
  window.addEventListener('online',wake);window.addEventListener('offline',offline);window.addEventListener('focus',wake);window.addEventListener('pageshow',wake);document.addEventListener('visibilitychange',wake);
  const unload=(e:BeforeUnloadEvent)=>{if(pending.current.length){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',unload);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('online',wake);window.removeEventListener('offline',offline);window.removeEventListener('focus',wake);window.removeEventListener('pageshow',wake);document.removeEventListener('visibilitychange',wake);window.removeEventListener('beforeunload',unload);connected.current=false;busy.current=false};
 },[token]);
 const change=useCallback(<C extends Collection>(collection:C,update:SetStateAction<Workspace[C]>)=>{
  if(!connected.current){setMessage('Der Teamstand wird noch geladen. Bitte kurz warten.');return}
  if(conflicted.current){setMessage('Bitte zuerst den gleichzeitigen Änderungskonflikt auflösen.');return}
  const before=live.current[collection];const after=typeof update==='function'?(update as (v:Workspace[C])=>Workspace[C])(before):update;
  const operations=diffRecords(collection,before,after);if(!operations.length)return;pending.current.push(...operations);live.current={...live.current,[collection]:after};setData(live.current);setPendingCount(pending.current.length);persist();setStatus('saving');queueMicrotask(()=>void refreshRef.current());
 },[]);
 const setMeetings=useCallback((update:SetStateAction<Meeting[]>)=>change('meetings',update),[change]);const setTodos=useCallback((update:SetStateAction<Todo[]>)=>change('todos',update),[change]);
 const retry=useCallback(()=>void refreshRef.current(),[]);
 const discardConflict=useCallback(()=>{try{localStorage.setItem('teamflow-conflict-backup',JSON.stringify({pending:pending.current,visible:live.current,savedAt:new Date().toISOString()}))}catch{}pending.current=[];conflicted.current=false;persist();publish();setMessage('Lokale Änderungen sind als Sicherung im Browser hinterlegt.');void refreshRef.current()},[]);
 const importLocal=useCallback(()=>{if(!connected.current||conflicted.current)return;const current=live.current;const additions={meetings:localImport.current.meetings.filter(m=>!current.meetings.some(x=>x.id===m.id)),todos:localImport.current.todos.filter(t=>!current.todos.some(x=>x.id===t.id))};if(additions.meetings.length)setMeetings([...current.meetings,...additions.meetings]);if(additions.todos.length)setTodos([...live.current.todos,...additions.todos]);setLocalCount(0)},[setMeetings,setTodos]);
 const copyTeamLink=useCallback(async()=>{if(!keyRef.current)return;const url=new URL(window.location.origin+window.location.pathname);await navigator.clipboard.writeText(url.href)},[]);
 const downloadBackup=useCallback(()=>{const blob=new Blob([JSON.stringify({pending:pending.current,local:localImport.current,conflict:readJson('teamflow-conflict-backup')},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='teamflow-lokale-sicherung.json';a.click();URL.revokeObjectURL(url)},[]);
 return {meetings:data.meetings,todos:data.todos,setMeetings,setTodos,ready:hydrated,status,message,authorized,lastUpdated,pendingCount,localCount,retry,discardConflict,importLocal,copyTeamLink,downloadBackup};
}
