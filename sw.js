const CACHE='ac-property-value-v11';
const ASSETS=[
  './','./index.html','./offline.html','./manifest.webmanifest',
  './assets/alert-construction-logo-white.svg','./assets/app-icon.svg',
  './electrical/','./plumbing/','./cladding/','./checklist/',
  './renovation-budget/','./renovation-budget/index.html','./renovation-budget/rates.js','./renovation-budget/app.js',
  './property-estimate/','./property-estimate/index.html','./property-estimate/app.js',
  './plan-ai/','./plan-ai/index.html','./plan-ai/styles.css','./plan-ai/config.js','./plan-ai/app.js',
  './quote-analysis/','./quote-analysis/index.html','./quote-analysis/app.js',
  './projects/','./projects/index.html','./projects/app.js',
  './login/','./login/index.html','./login/app.js',
  './catalogue/','./catalogue/index.html','./catalogue/app.js',
  './shared/platform-config.js','./shared/auth.js','./shared/project-store.js','./shared/project-bridge.js',
  './shared/product-shell.js','./shared/cloud-sync.js','./shared/catalogue-defaults.js','./shared/catalogue-runtime.js'
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
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./offline.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>{
    const fresh=fetch(event.request).then(response=>{if(response&&response.status===200){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>cached);
    return cached||fresh;
  }));
});
