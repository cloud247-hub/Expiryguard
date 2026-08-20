const CACHE='expiryguard-v4-1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./config.js','./assets/cloud247-logo.svg','./assets/cloud247-mark.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});return r;}).catch(()=>caches.match(event.request)));});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=event.notification?.data?.url||'./';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate?.(target);return client.focus();}}if(clients.openWindow)return clients.openWindow(target);}));});
