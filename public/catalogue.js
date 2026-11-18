/* IndexedDB metadata catalogue ONLY. Never cache YouTube media, thumbnails or embeds.
 * Syncs fixed, server-allowlisted API pages when the app is open and online. */
(function () {
  'use strict';
  const DATABASE='kidlite-offline-catalog-v1',STORE='videos',META='state';
  const MAX_ITEMS=1100,MAX_CHARS=460000,MIN_SYNC_MS=30*60*1000;
  let syncPromise=null;

  const approved=new Set(['chuchutamil','pattampoochi','infobellstamil','shemarootamil',
    'chuttykannamma','kidstvtamil','cocomelon','kidschannel',
    'bumblezoop','bachpankiduniya','bibotoys']);
  function normalize(raw,kind) {
    if (!raw || !/^[\w-]{11}$/.test(raw.id||'') || !approved.has(raw.channelKey)) return null;
    const title=String(raw.title||'').slice(0,180);
    const channel=String(raw.channel||'').slice(0,90);
    if (!title || !channel) return null;
    return {
      key:kind+':'+raw.id,id:raw.id,kind,title,channel,channelKey:raw.channelKey,
      publishedAt:String(raw.publishedAt||'').slice(0,35),
      durationSeconds:Math.max(0,Math.min(7200,Number(raw.durationSeconds)||0)),
      source:'YouTube',onlineOnly:true
    };
  }
  function requestToPromise(request) {
    return new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error || Error('IndexedDB unavailable'));
    });
  }
  function openDB() {
    return new Promise((resolve,reject)=>{
      if (!('indexedDB' in window)) {reject(Error('IndexedDB unavailable'));return;}
      const request=indexedDB.open(DATABASE,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
        if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'name'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('Failed to open offline catalogue'));
      request.onblocked=()=>reject(Error('Offline catalogue locked'));
    });
  }
  function txFinish(transaction) {
    return new Promise((resolve,reject)=>{
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error||Error('Offline save failed'));
      transaction.onabort=()=>reject(transaction.error||Error('Offline save aborted'));
    });
  }
  async function readAll() {
    const db=await openDB();
    try {
      const tx=db.transaction([STORE,META],'readonly');
      const videos=requestToPromise(tx.objectStore(STORE).getAll());
      const state=requestToPromise(tx.objectStore(META).get('lastSync'));
      const [items,info]=await Promise.all([videos,state]);
      return {items,updatedAt:info?.at||0};
    } finally {db.close();}
  }
  async function getStatus() {
    try {
      const current=await readAll();
      const expired=current.updatedAt>0 && Date.now()-current.updatedAt>25*24*60*60*1000;
      return {
        available:true,expired,updatedAt:current.updatedAt,count:expired?0:current.items.length,
        shorts:expired?0:current.items.filter(x=>x.kind==='short').length,
        longs:expired?0:current.items.filter(x=>x.kind==='video').length
      };
    } catch (_) {return {available:false,updatedAt:0,count:0,shorts:0,longs:0};}
  }
  async function getItems(options={}) {
    try {
      const current=await readAll();
      if(!current.updatedAt || Date.now()-current.updatedAt>25*24*60*60*1000)return [];
      const query=String(options.q||'').trim().toLocaleLowerCase().slice(0,60);
      const kind=options.kind||'all',channel=options.channel||'all';
      return current.items.filter(v=>
        (kind==='all'||v.kind===kind) &&
        (channel==='all'||channel==='tamil'&&v.channelKey!=='cocomelon'&&v.channelKey!=='kidschannel'||v.channelKey===channel) &&
        (!query||(v.title+' '+v.channel).toLocaleLowerCase().includes(query))
      ).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
    } catch (_) {return [];}
  }
  function isOnline() {return navigator.onLine!==false;}
  async function synchronize(force=false) {
    if (!isOnline()) return {ok:false,reason:'offline'};
    if (syncPromise) return syncPromise;
    syncPromise=(async()=>{
      let prior;
      try {prior=await readAll();} catch (_) {return {ok:false,reason:'storage-unavailable'};}
      if(!force && Date.now()-prior.updatedAt<MIN_SYNC_MS)return {ok:true,skipped:true,count:prior.items.length};

      try {
        const [longResponse,shortResponse]=await Promise.all([
          fetch('/api/videos?kind=video&channel=all&age=all',{cache:'no-store'}),
          fetch('/api/videos?kind=short&channel=all&age=all',{cache:'no-store'})
        ]);
        if(!longResponse.ok || !shortResponse.ok)throw Error('Sync API unavailable');
        const [longs,shorts]=await Promise.all([longResponse.json(),shortResponse.json()]);
        // Never replace a good catalogue with an incomplete or fallback/errored response.
        if(longs.mode!=='youtube-live'||shorts.mode!=='youtube-live' || longs.notice || shorts.notice ||
          !Array.isArray(longs.videos)||!Array.isArray(shorts.videos))throw Error('Incomplete video catalogue');

        const next=new Map();
        for(const [data,kind] of [[longs.videos,'video'],[shorts.videos,'short']]) {
          for(const item of data) {
            const v=normalize(item,kind);
            if(v) next.set(v.key,v);
          }
        }
        const sorted=[...next.values()].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
        let chars=0;
        const retained=[];
        for(const item of sorted) {
          const itemChars=JSON.stringify(item).length;
          if(retained.length>=MAX_ITEMS||chars+itemChars>MAX_CHARS)break;
          chars+=itemChars;retained.push(item);
        }
        // Atomic transaction: delete disappeared IDs and update only changed/new metadata.
        const previous=new Map(prior.items.map(v=>[v.key,v]));
        const keep=new Set(retained.map(x=>x.key));
        const db=await openDB();
        try {
          const transaction=db.transaction([STORE,META],'readwrite');
          const table=transaction.objectStore(STORE);
          for(const old of prior.items)if(!keep.has(old.key))table.delete(old.key);
          let changed=0;
          for(const item of retained) {
            if(JSON.stringify(previous.get(item.key))!==JSON.stringify(item)){
              table.put(item);changed++;
            }
          }
          transaction.objectStore(META).put({name:'lastSync',at:Date.now()});
          await txFinish(transaction);
          window.dispatchEvent(new CustomEvent('kidlite:catalog-updated',{detail:{count:retained.length}}));
          return {ok:true,count:retained.length,changed,removed:prior.items.length-retained.filter(x=>previous.has(x.key)).length};
        } finally {db.close();}
      } catch (_) {return {ok:false,reason:'sync-failed'};}
    })();
    try {return await syncPromise;} finally {syncPromise=null;}
  }
  async function clear() {
    const db=await openDB();
    try {
      const tx=db.transaction([STORE,META],'readwrite');
      tx.objectStore(STORE).clear();
      tx.objectStore(META).clear();
      await txFinish(tx);
      window.dispatchEvent(new Event('kidlite:catalog-updated'));
      return true;
    } finally {db.close();}
  }
  function schedule() {
    if(!isOnline())return;
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    // Preserve very low-bandwidth connections; manual sync still works.
    if(connection?.saveData)return;
    synchronize(false).catch(()=>{});
  }
  window.KidLiteCatalogue={synchronize,getStatus,getItems,clear};
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')schedule();
  });
  window.addEventListener('load',()=>setTimeout(schedule,1200),{once:true});
})();
