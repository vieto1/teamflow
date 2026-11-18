import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const url='https://bewbgijcyyckamhnomrd.supabase.co',key='sb_publishable_L_8uFsJnZ_Z85-99eqJmEQ_kKVkEnGA';
const a=createClient(url,key,{auth:{persistSession:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}}),b=createClient(url,key,{auth:{persistSession:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}});
const checked=r=>{if(r.error)throw r.error;return r.data};
const board=checked(await a.from('exit_boards').insert({title:'Automatischer Board-Test'}).select().single());
try{
 const first={id:'first',type:'rectangle',version:1,versionNonce:90,isDeleted:false};const second={id:'second',type:'frame',version:1,versionNonce:80,isDeleted:false};
 await Promise.all([a.rpc('exit_merge_board',{p_board:board.id,p_elements:[first]}).then(checked),b.rpc('exit_merge_board',{p_board:board.id,p_elements:[second]}).then(checked)]);
 assert.equal(checked(await b.from('exit_board_elements').select('*').eq('board_id',board.id)).length,2);
 checked(await a.rpc('exit_merge_board',{p_board:board.id,p_elements:[{...first,version:3,isDeleted:true}]}));
 checked(await b.rpc('exit_merge_board',{p_board:board.id,p_elements:[{...first,version:2}]}));
 let saved=checked(await b.from('exit_board_elements').select('element').eq('board_id',board.id).eq('id','first').single());assert.equal(saved.element.version,3);assert.equal(saved.element.isDeleted,true);
 await Promise.all([a.rpc('exit_merge_board',{p_board:board.id,p_elements:[{...second,version:2,versionNonce:50}]}).then(checked),b.rpc('exit_merge_board',{p_board:board.id,p_elements:[{...second,version:2,versionNonce:20}]}).then(checked)]);
 saved=checked(await a.from('exit_board_elements').select('element').eq('board_id',board.id).eq('id','second').single());assert.equal(saved.element.versionNonce,20);
 const c1=a.channel('test-'+board.id),c2=b.channel('test-'+board.id);
 await Promise.all([c1,c2].map(c=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Realtime connection timeout')),12000);c.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(t);resolve()}})})));
 const received=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Broadcast timeout')),8000);c2.on('broadcast',{event:'test'},({payload})=>{clearTimeout(t);assert.equal(payload.message,'live');resolve()})});
 assert.equal(await c1.send({type:'broadcast',event:'test',payload:{message:'live'}}),'ok');await received;
 await Promise.all([a.removeChannel(c1),b.removeChannel(c2)]);
 console.log('PASS: concurrent objects, stale-write protection, deletion tombstones, deterministic ties, cross-client live broadcast');
}finally{checked(await a.from('exit_boards').delete().eq('id',board.id));a.realtime.disconnect();b.realtime.disconnect()}
