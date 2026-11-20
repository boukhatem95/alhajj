'use strict';
/* الحاج — service worker (network-first so updates always arrive, cache as the offline fallback) */
var CACHE='hajj-v2';
var SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];
var NET_TIMEOUT=4000;

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return fetch(new Request(u,{cache:'reload'})).then(function(r){
          if(!r.ok)throw new Error('shell '+u+' '+r.status);
          return c.put(u,r);
        });
      }));
    }).then(function(){return self.skipWaiting();})
  );
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});
function cacheKey(req){var u=new URL(req.url);return new Request(u.origin+u.pathname);}
function remember(req,res){
  if(res&&res.ok&&res.type==='basic'){
    var copy=res.clone();
    caches.open(CACHE).then(function(c){return c.put(cacheKey(req),copy);}).catch(function(){});
  }
}
function fromCache(req){
  return caches.match(req,{ignoreSearch:true}).then(function(hit){
    if(hit)return hit;
    if(req.mode==='navigate')return caches.match('index.html').then(function(h){return h||caches.match('./');});
    return undefined;
  });
}
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin===self.location.origin){
    var net=fetch(req.url,{cache:'no-cache',credentials:'same-origin'}).then(function(res){remember(req,res);return res;});
    e.waitUntil(net.catch(function(){}));
    var timer=new Promise(function(r){setTimeout(function(){r(null);},NET_TIMEOUT);});
    e.respondWith(
      Promise.race([net.catch(function(){return null;}),timer]).then(function(res){
        if(res&&res.ok)return res;
        return fromCache(req).then(function(hit){
          if(hit)return hit;
          if(res)return res;
          return net.catch(function(){return Response.error();});
        });
      })
    );
    return;
  }
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(
      caches.match(req).then(function(hit){
        var f=fetch(req).then(function(res){
          if(res&&(res.ok||res.type==='opaque')){var copy=res.clone();caches.open(CACHE).then(function(c){return c.put(req,copy);}).catch(function(){});}
          return res;
        });
        if(hit){f.catch(function(){});return hit;}
        return f.catch(function(){return Response.error();});
      })
    );
  }
});
