const C='recordly-v4',F=['./','index.html','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','privacy.html','terms.html'];
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>clients.claim())));
// Open instantly from the saved copy, then refresh it quietly in the background.
// (The old version waited for the network first, which is what made opening slow on weak signal.)
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const same=url.origin===location.origin;
  if(!same&&!url.href.startsWith(LIB))return;          // everything else (Supabase API etc.) goes straight to the network
  e.respondWith(caches.open(C).then(async cache=>{
    const hit=await cache.match(req,{ignoreSearch:same});
    const net=fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))cache.put(req,r.clone());return r}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return (await net)||new Response('You are offline and this page is not saved yet.',{status:503});
  }));
});
self.addEventListener('push',e=>{
  let p={title:'Recordly',body:'You have a new payment update.',url:'#/notifications',tag:'rc-push'};
  try{if(e.data){const d=e.data.json();if(d&&typeof d==='object')p=Object.assign(p,d);}}catch(err){try{p.body=e.data.text()||p.body;}catch(x){}}
  e.waitUntil(self.registration.showNotification(p.title,{
    body:p.body,
    icon:'icon-192.png',
    badge:'icon-192.png',
    tag:p.tag||'rc-push',
    data:{url:p.url||'#/notifications'}
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=(e.notification&&e.notification.data&&e.notification.data.url)||'#/notifications';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){
      if('focus' in c){
        c.focus();
        c.postMessage({type:'goto',hash:target});
        return;
      }
    }
    if(clients.openWindow)return clients.openWindow('./'+target);
  }));
});
