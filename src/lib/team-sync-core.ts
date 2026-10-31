export type Meeting={id:string;title:string;date:string;time:string;length:string;people:string[];videoRoom?:string;summary?:string;keyPoints?:string[];decisions?:string[];transcript?:string};
export type Todo={id:string;title:string;assignee:string;dueDate:string;status:'Offen'|'In Arbeit'|'Erledigt';meetingId?:string};
export type Workspace={meetings:Meeting[];todos:Todo[]};
export type Collection=keyof Workspace;
export type Entity=Meeting|Todo;
export type Operation={collection:Collection;id:string;before:Entity|null;after:Entity|null};
export type Snapshot={revision:number;data:Workspace;updated_at?:string};
export const emptyWorkspace=():Workspace=>({meetings:[],todos:[]});
function canonical(value:unknown):string {if(value===undefined)return 'undefined';if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}'}
export const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export function diffRecords(collection:Collection,before:Entity[],after:Entity[]):Operation[]{const old=new Map(before.map(v=>[v.id,v])),next=new Map(after.map(v=>[v.id,v]));const ops:Operation[]=[];for(const [id,v]of old)if(!next.has(id))ops.push({collection,id,before:v,after:null});for(const [id,v]of next)if(!same(old.get(id),v))ops.push({collection,id,before:old.get(id)||null,after:v});return ops}
export class SyncConflict extends Error {constructor(public fields:string[]){super('Ein Eintrag wurde inzwischen von jemand anderem geändert.')}}
export function applyOperations(data:Workspace,ops:Operation[],checkConflicts=true):Workspace{
 const next=structuredClone(data);
 for(const op of ops){const list=next[op.collection] as Entity[];const i=list.findIndex(e=>e.id===op.id);const current=i<0?null:list[i];
  if(!op.after){if(!current)continue;if(checkConflicts&&!same(current,op.before))throw new SyncConflict(['Gelöschter Eintrag wurde geändert']);list.splice(i,1);continue;}
  if(!op.before){if(current){const equivalent=same(current,op.after)||(op.collection==='meetings'&&!(op.after as Meeting).videoRoom&&same({...current,videoRoom:undefined},{...op.after,videoRoom:undefined}));if(checkConflicts&&!equivalent)throw new SyncConflict(['Eintrag existiert bereits']);if(!checkConflicts)list[i]=structuredClone(op.after);}else list.unshift(structuredClone(op.after));continue;}
  if(!current){if(checkConflicts)throw new SyncConflict(['Eintrag wurde entfernt']);list.unshift(structuredClone(op.after));continue;}
  const before=op.before as unknown as Record<string,unknown>,after=op.after as unknown as Record<string,unknown>,record={...current} as unknown as Record<string,unknown>;
  const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>k!=='id'&&!same(before[k],after[k]));
  const conflicts=changed.filter(k=>!same(record[k],before[k])&&!same(record[k],after[k]));if(checkConflicts&&conflicts.length)throw new SyncConflict(conflicts);
  for(const key of changed){if(after[key]===undefined)delete record[key];else record[key]=structuredClone(after[key])}list[i]=record as unknown as Entity;
 }
 return next;
}
const meetingKeys=new Set(['id','title','date','time','length','people','videoRoom','summary','keyPoints','decisions','transcript']);const todoKeys=new Set(['id','title','assignee','dueDate','status','meetingId']);
export function validEntity(collection:Collection,value:unknown):value is Entity{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;const keys=collection==='meetings'?meetingKeys:todoKeys;
 if(Object.keys(v).some(k=>!keys.has(k)))return false;
 const str=(k:string,max=400)=>typeof v[k]==='string'&&(v[k] as string).length<=max;
 if(!str('id',150)||!v.id||!str('title',500)||!String(v.title).trim())return false;
 const date=(k:string,empty=false)=>str(k,10)&&((empty&&v[k]==='')||/^\d{4}-\d{2}-\d{2}$/.test(String(v[k])));
 if(collection==='meetings')return date('date')&&str('time',5)&&(/^(\d{2}:\d{2})?$/.test(String(v.time)))&&str('length',100)&&Array.isArray(v.people)&&v.people.length<=30&&v.people.every(p=>typeof p==='string'&&p.length<100)&&(['videoRoom','summary','transcript'] as const).every(k=>v[k]===undefined||str(k,k==='transcript'?200000:k==='summary'?20000:100))&&(!v.videoRoom||/^teamflow-[a-zA-Z0-9-]{20,80}$/.test(String(v.videoRoom)))&&['keyPoints','decisions'].every(k=>v[k]===undefined||(Array.isArray(v[k])&&(v[k] as unknown[]).length<=100&&(v[k] as unknown[]).every(x=>typeof x==='string'&&x.length<=5000)));
 return str('assignee',100)&&date('dueDate',true)&&['Offen','In Arbeit','Erledigt'].includes(String(v.status))&&(v.meetingId===undefined||str('meetingId',150));
}
export function validOperations(value:unknown):value is Operation[]{return Array.isArray(value)&&value.length>0&&value.length<=100&&value.every(op=>op&&['meetings','todos'].includes(op.collection)&&typeof op.id==='string'&&op.id.length<=150&&(op.before===null||validEntity(op.collection,op.before))&&(op.after===null||validEntity(op.collection,op.after))&&(op.before||op.after)&&(!op.before||op.before.id===op.id)&&(!op.after||op.after.id===op.id))}
