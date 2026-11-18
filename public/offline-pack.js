/* KidLite authorized offline video pack.
 * Only admin-listed, rights-confirmed first-party /owned-media/ assets.
 * Never download, cache, proxy, or rehost YouTube audiovisual content. */
(function () {
  'use strict';
  const DB_NAME='kidlite-owned-media-v1', DB_VERSION=1;
  const FILES='files', ENTRIES='entries';
  const ORIGIN_CAP=100000000, MEDIA_CAP=95000000, HEADROOM=512000;
  const COUNT_LIMIT={main:15,short:50};
  const INITIAL={main:5,short:15}, DAILY={main:2,short:5};
  const MAX_FILE={main:5000000,short:1500000};
  const LAST_AUTO='kidlite.owned-pack.last-auto.v1';
  const AUTO='kidlite.owned-pack.wifi-auto.v1';
  const DAY=24*60*60*1000;
  let busy=null,controller=null,playingId=null;

  function validAsset(raw){
    if(!raw || !/^[a-zA-Z0-9_-]{3,64}$/.test(raw.id||''))return null;
    if(!['owned','licensed-offline'].includes(raw.offlineRights))return null;
    if(!['main','short'].includes(raw.kind))return null;
    if(typeof raw.title!=='string'||!raw.title.trim())return null;
    const mime=String(raw.mime||'').toLowerCase();
    // Choose only formats the current phone says it can decode.
    const sample=document.createElement('video');
    if(typeof sample.canPlayType==='function' && !sample.canPlayType(mime))return null;
    if(!/^video\/(mp4|webm)(;\s*codecs="[a-z0-9., -]+")?$/.test(mime))return null;
    const size=Number(raw.sizeBytes);
    if(!Number.isSafeInteger(size)||size<1024||size>MAX_FILE[raw.kind])return null;
    const url=String(raw.url||'');
    if(!/^\/owned-media\/[a-zA-Z0-9_./-]+\.(mp4|webm)$/.test(url)||
      url.split('/').includes('..')||url.includes('//'))return null;
    if((url.endsWith('.mp4')?'video/mp4':'video/webm')!==mime.split(';')[0])return null;
    if(!/^[a-f0-9]{64}$/.test(raw.sha256||''))return null;
    return {id:raw.id,kind:raw.kind,title:raw.title.trim().slice(0,150),
      url,mime,bytes:size,sha256:raw.sha256,offlineRights:raw.offlineRights};
  }
  async function manifest(){
    if(navigator.onLine===false)throw Error('Offline — cannot refresh the download catalogue');
    const response=await fetch('/offline-video-manifest.json',{cache:'no-store'});
    if(!response.ok)throw Error('Offline media catalogue unavailable');
    const data=await response.json();
    if(data.version!==1||!Array.isArray(data.videos))throw Error('Invalid offline media catalogue');
    const seen=new Set(),counts={main:0,short:0},videos=[];
    for(const raw of data.videos){
      const item=validAsset(raw);
      if(!item||seen.has(item.id)||counts[item.kind]>=COUNT_LIMIT[item.kind])continue;
      seen.add(item.id);counts[item.kind]++;videos.push(item);
    }
    return videos;
  }
  function req(request){
    return new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('Offline database unavailable'));
    });
  }
  function openDB(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(Error('This browser has no IndexedDB'));return;}
      const r=indexedDB.open(DB_NAME,DB_VERSION);
      r.onupgradeneeded=()=>{
        const db=r.result;
        if(!db.objectStoreNames.contains(FILES))db.createObjectStore(FILES);
        if(!db.objectStoreNames.contains(ENTRIES))db.createObjectStore(ENTRIES,{keyPath:'id'});
      };
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error||Error('Could not open offline video database'));
      r.onblocked=()=>reject(Error('Offline database is busy in another tab'));
    });
  }
  function finished(tx){
    return new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||Error('Offline transaction failed'));
      tx.onabort=()=>reject(tx.error||Error('Offline transaction aborted'));
    });
  }
  async function list(){
    const db=await openDB();
    try{
      const tx=db.transaction(ENTRIES,'readonly');
      const result=await req(tx.objectStore(ENTRIES).getAll());
      return result.sort((a,b)=>Number(b.downloadedAt||0)-Number(a.downloadedAt||0));
    }finally{db.close();}
  }
  async function get(id){
    const db=await openDB();
    try{
      const tx=db.transaction(FILES,'readonly');
      const blob=await req(tx.objectStore(FILES).get(id));
      return blob instanceof Blob?blob:null;
    }finally{db.close();}
  }
  async function markPlayed(id){
    playingId=id;
    const db=await openDB();
    try{
      const tx=db.transaction(ENTRIES,'readwrite');
      const completion=finished(tx);
      const store=tx.objectStore(ENTRIES);
      const record=await req(store.get(id));
      if(record){record.lastPlayedAt=Date.now();store.put(record);}
      await completion;
    }finally{db.close();}
  }
  function stopPlayback(){playingId=null;}
  async function erase(ids){
    if(!ids.length)return;
    const db=await openDB();
    try{
      const tx=db.transaction([FILES,ENTRIES],'readwrite');
      for(const id of ids){
        tx.objectStore(FILES).delete(id);
        tx.objectStore(ENTRIES).delete(id);
      }
      await finished(tx);
    }finally{db.close();}
  }
  async function remove(id){
    if(playingId===id)throw Error('Stop this video before removing it');
    await erase([id]);
  }
  async function clear(){
    if(busy)throw Error('Cancel the current download first');
    playingId=null;
    const db=await openDB();
    try{
      const tx=db.transaction([FILES,ENTRIES],'readwrite');
      tx.objectStore(FILES).clear();
      tx.objectStore(ENTRIES).clear();
      await finished(tx);
    }finally{db.close();}
  }
  async function deviceEstimate(){
    if(typeof navigator.storage?.estimate!=='function')return null;
    const est=await navigator.storage.estimate();
    const usage=Number(est.usage),quota=Number(est.quota);
    if(!Number.isFinite(usage)||!Number.isFinite(quota))return null;
    return {usage,quota};
  }
  async function status(){
    const items=await list();
    const estimated=await deviceEstimate().catch(()=>null);
    return {items,main:items.filter(x=>x.kind==='main').length,
      shorts:items.filter(x=>x.kind==='short').length,
      mediaBytes:items.reduce((n,x)=>n+Number(x.bytes||0),0),
      originBytes:estimated?.usage??null,
      quotaBytes:estimated?.quota??null,
      mediaCap:MEDIA_CAP,originCap:ORIGIN_CAP};
  }
  function chooseEvictions(items,item,bytes,est){
    const survivors=items.filter(x=>x.id!==item.id);
    const deleted=[];
    const usage=est.usage;
    const usedBytes=()=>survivors.reduce((n,x)=>n+Number(x.bytes||0),0)+bytes;
    const originBytes=()=>usage+bytes-
      (items.find(x=>x.id===item.id)?.bytes||0)-
      deleted.reduce((n,x)=>n+Number(x.bytes||0),0);
    const count=kind=>survivors.filter(x=>x.kind===kind).length+(item.kind===kind?1:0);
    const exceeds=()=>usedBytes()>MEDIA_CAP||originBytes()+HEADROOM>ORIGIN_CAP||
      count('main')>COUNT_LIMIT.main||count('short')>COUNT_LIMIT.short||
      originBytes()+HEADROOM>est.quota;
    while(exceeds()){
      const tightKind=count(item.kind)>COUNT_LIMIT[item.kind] ? item.kind : null;
      const eligible=survivors.filter(x=>x.id!==playingId && (!tightKind||x.kind===tightKind));
      eligible.sort((a,b)=>{
        // Watched entries are evicted first, oldest watched/downloaded first.
        const aw=Number(Boolean(a.lastPlayedAt)),bw=Number(Boolean(b.lastPlayedAt));
        if(aw!==bw)return bw-aw;
        return (a.lastPlayedAt||a.downloadedAt||0)-(b.lastPlayedAt||b.downloadedAt||0);
      });
      if(!eligible.length)throw Error('100 MB cap reached; no safe space for this video');
      const victim=eligible[0];
      survivors.splice(survivors.indexOf(victim),1);
      deleted.push(victim);
    }
    return deleted;
  }
  async function fetchVerified(item,signal){
    const response=await fetch(item.url,{cache:'no-store',credentials:'same-origin',
      redirect:'error',signal});
    if(!response.ok||response.type==='opaque'||new URL(response.url).origin!==location.origin ||
      new URL(response.url).pathname!==item.url)throw Error('First-party video unavailable');
    const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!['video/mp4','video/webm'].includes(type) ||
      type!==item.mime.split(';')[0])throw Error('Unexpected file format');
    const length=Number(response.headers.get('content-length'));
    if(length>0&&length!==item.bytes)throw Error('Video file size changed');
    let blob;
    if(response.body?.getReader){
      const reader=response.body.getReader();
      const chunks=[];let bytes=0;
      try{
        while(true){
          const {value,done}=await reader.read();
          if(done)break;
          bytes+=value.byteLength;
          if(bytes>item.bytes||bytes>MAX_FILE[item.kind]){
            await reader.cancel();throw Error('Video exceeds approved size');
          }
          chunks.push(value);
        }
      }finally{try{reader.releaseLock();}catch(_){}}
      if(bytes!==item.bytes)throw Error('Incomplete video download');
      blob=new Blob(chunks,{type:item.mime});
    }else{
      blob=await response.blob();
      if(blob.size!==item.bytes||blob.size>MAX_FILE[item.kind])
        throw Error('Video exceeds approved size');
    }
    if(!crypto.subtle?.digest)throw Error('Secure file verification unavailable');
    const bytes=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    const digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==item.sha256)throw Error('Video integrity check failed');
    return blob;
  }
  async function saveOne(item,blob,signal){
    if(signal.aborted)throw Error('Download cancelled');
    const [items,est]=await Promise.all([list(),deviceEstimate()]);
    if(!est)throw Error('This device cannot report storage usage safely');
    const old=items.find(x=>x.id===item.id);
    if(old && old.sha256===item.sha256)return {saved:false,evicted:0};
    const victims=chooseEvictions(items,item,blob.size,est);
    if(signal.aborted)throw Error('Download cancelled');
    const db=await openDB();
    try{
      const tx=db.transaction([FILES,ENTRIES],'readwrite');
      for(const x of victims){
        tx.objectStore(FILES).delete(x.id);
        tx.objectStore(ENTRIES).delete(x.id);
      }
      tx.objectStore(FILES).put(blob,item.id);
      tx.objectStore(ENTRIES).put({id:item.id,title:item.title,kind:item.kind,
        mime:item.mime,bytes:blob.size,sha256:item.sha256,downloadedAt:Date.now(),
        lastPlayedAt:old?.lastPlayedAt||0,offlineRights:item.offlineRights});
      await finished(tx);
      return {saved:true,evicted:victims.length};
    }finally{db.close();}
  }
  function notify(progress){
    window.dispatchEvent(new CustomEvent('kidlite:offline-pack-progress',{detail:progress}));
  }
  async function download(options={}){
    if(busy)return busy;
    if(navigator.onLine===false)throw Error('Connect to the internet before downloading');
    const sizes=options.mode==='next'?DAILY:INITIAL;
    controller=new AbortController();
    const signal=controller.signal;
    busy=(async()=>{
      const available=await manifest();
      const current=await list();
      // Only delete revoked or changed source clips after a successful live manifest.
      const approved=new Map(available.map(v=>[v.id,v]));
      const removed=current.filter(x=>!approved.has(x.id)).map(x=>x.id);
      if(removed.length)await erase(removed.filter(id=>id!==playingId));
      const fresh=await list(),saved=new Map(fresh.map(x=>[x.id,x]));
      const selected=[];
      for(const kind of ['main','short']){
        const missing=available.filter(x=>x.kind===kind &&
          saved.get(x.id)?.sha256!==x.sha256);
        selected.push(...missing.slice(0,sizes[kind]));
      }
      if(!selected.length)return {ok:true,count:0,evicted:0,
        message:available.length?'Already up to date':'No rights-cleared original videos have been added yet'};
      let count=0,evicted=0;const errors=[];
      for(const item of selected){
        if(signal.aborted)break;
        notify({active:true,title:item.title,done:count,total:selected.length});
        try{
          // Validate budget BEFORE transferring bytes to avoid wasting data.
          const [current,est]=await Promise.all([list(),deviceEstimate()]);
          if(!est)throw Error('Browser storage estimate unavailable');
          chooseEvictions(current,item,item.bytes,est);
          const blob=await fetchVerified(item,signal);
          const result=await saveOne(item,blob,signal);
          if(result.saved)count++;
          evicted+=result.evicted;
        }catch(error){
          if(signal.aborted)break;
          errors.push(item.title+': '+String(error.message||error));
        }
        notify({active:true,title:item.title,done:count,total:selected.length});
      }
      return {ok:errors.length===0&&!signal.aborted,count,evicted,
        cancelled:signal.aborted,errors,message:errors[0]||''};
    })();
    try{return await busy;}
    finally{busy=null;controller=null;notify({active:false});}
  }
  function cancel(){controller?.abort();}
  function wifiAutoEnabled(){
    try{return localStorage.getItem(AUTO)==='1';}catch(_){return false;}
  }
  function enableWifiAuto(enabled){
    try{localStorage.setItem(AUTO,enabled?'1':'0');}catch(_){}
  }
  function knownWifi(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    return Boolean(c && !c.saveData && (c.type==='wifi'||c.type==='ethernet'));
  }
  async function maybeWifiSync(){
    if(!wifiAutoEnabled()||!knownWifi()||navigator.onLine===false||
      document.visibilityState!=='visible'||busy)return {skipped:true};
    let last=0;
    try{last=Number(localStorage.getItem(LAST_AUTO))||0;}catch(_){}
    if(Date.now()-last<DAY)return {skipped:true};
    // Date is recorded BEFORE sync to prevent infinite retries on bad networks.
    try{localStorage.setItem(LAST_AUTO,String(Date.now()));}catch(_){}
    try{return await download({mode:(await list()).length?'next':'starter'});}
    catch(_){return {skipped:true};}
  }
  window.KidLiteOfflinePack={manifest,list,get,status,download,cancel,clear,remove,
    markPlayed,stopPlayback,enableWifiAuto,wifiAutoEnabled,maybeWifiSync,
    limits:{originBytes:ORIGIN_CAP,mediaBytes:MEDIA_CAP,main:15,short:50}};
})();
