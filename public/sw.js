/* Only this app's static assets are cached; team data, uploads and calls always use the network. */
const VERSION='__TEAMFLOW_VERSION__';
const PREFIX='teamflow-pwa-';
const CACHE=PREFIX+VERSION;
const BASE=new URL('./',self.location).pathname;
const OFFLINE=BASE+'offline.html';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([OFFLINE,BASE+'exit-shift-192-v1.png']))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(async()=>await caches.match(OFFLINE)||new Response('Bitte Internetverbindung prüfen.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));return}
 const immutable=url.pathname.startsWith(BASE+'_next/static/');
 const asset=/\/(?:app-icon-(?:192|512|maskable)\.png|apple-touch-icon\.png)$/.test(url.pathname);
 if(!immutable&&!asset)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(req);if(cached)return cached;const response=await fetch(req);if(response.ok&&response.type==='basic'){await cache.put(req,response.clone());const keys=await cache.keys();if(keys.length>90){const removable=keys.filter(k=>new URL(k.url).pathname!==OFFLINE);for(const key of removable.slice(0,keys.length-90))await cache.delete(key)}}return response})());
});
