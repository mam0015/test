const CACHE='ac-complete-ai-root-fix-v7';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/alert-construction-logo-white.svg',
  './assets/app-icon.svg',
  './electrical/',
  './plumbing/',
  './cladding/',
  './plan-ai/',
  './plan-ai/index.html',
  './plan-ai/styles.css',
  './plan-ai/config.js',
  './plan-ai/app.js',
  './quote-analysis/',
  './quote-analysis/index.html',
  './quote-analysis/app.js',
  './projects/',
  './projects/index.html',
  './projects/app.js',
  './shared/project-store.js',
  './shared/project-bridge.js',
  './checklist/'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(ASSETS.map(asset=>cache.add(asset)))));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>{
    const fresh=fetch(event.request).then(response=>{
      if(response&&response.status===200){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
      return response;
    }).catch(()=>cached);
    return cached||fresh;
  }));
});
