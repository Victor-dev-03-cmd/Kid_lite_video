/* Offline Video Pack UI — lazy-loaded only when parents open Offline Play. */
(function(){
  'use strict';
  let activeNode=null,activeVideo=null,objectURL=null,progressListener=null;
  function stop(){
    try{activeVideo?.pause();}catch(_){}
    if(activeVideo){activeVideo.removeAttribute('src');activeVideo.load();}
    activeVideo=null;
    if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
    window.KidLiteOfflinePack?.stopPlayback();
  }
  function dispose(){
    window.KidLiteOfflinePack?.cancel();
    stop();
    if(progressListener)window.removeEventListener('kidlite:offline-pack-progress',progressListener);
    progressListener=null;activeNode=null;
  }
  function el(tag,className,text){
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  const mb=value=>(Math.max(0,Number(value)||0)/1000000).toFixed(1)+' MB';
  async function render(node){
    dispose();
    activeNode=node;
    const pack=window.KidLiteOfflinePack;
    const live=()=>activeNode===node&&node.isConnected;
    const intro=el('div','offline-pack-intro');
    intro.append(el('strong',null,'100 MB phone storage plan'),
      el('p',null,'Offline videos must be KidLite-owned or licensed for offline downloads. YouTube videos still need internet.'));
    const meter=el('div','offline-pack-meter');meter.setAttribute('role','progressbar');
    meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
    meter.setAttribute('aria-label','KidLite phone storage used');
    const fill=el('div','offline-pack-meter-fill');meter.append(fill);
    const usage=el('p','offline-pack-usage','Checking phone storage…');
    const message=el('p','offline-pack-message');
    message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    const controls=el('div','offline-pack-actions');
    const starter=el('button','primary-button','Download first 5 videos + 15 Shorts');
    const more=el('button','text-button','Get next 2 videos + 5 Shorts');
    const cancel=el('button','text-button','Cancel download');cancel.hidden=true;
    const clear=el('button','text-button','Delete downloaded videos');
    for(const b of [starter,more,cancel,clear]){b.type='button';controls.append(b);}
    const autoLabel=el('label','offline-pack-auto');
    const toggle=el('input');toggle.type='checkbox';toggle.setAttribute('aria-label','Wi-Fi-only daily offline video updates');
    autoLabel.append(toggle,el('span',null,'Small daily batches on Wi-Fi (only while app is open)'));
    const note=el('p','offline-pack-notice','Downloads start only with your permission. Auto-updates are opt-in and require detectable Wi-Fi. Stored data may be removed by browser storage cleanup.');
    const player=el('div','offline-pack-player');
    const title=el('h3','offline-pack-heading','Videos saved on this phone');
    const list=el('div','offline-pack-list');
    node.append(intro,meter,usage,message,controls,autoLabel,note,player,title,list);

    let available=[],downloading=false,hasManifest=false;
    toggle.checked=pack.wifiAutoEnabled();
    function buttons(){
      const enabled=hasManifest&&available.length>0&&navigator.onLine!==false&&!downloading;
      starter.disabled=!enabled;more.disabled=!enabled;cancel.hidden=!downloading;
      clear.disabled=downloading;toggle.disabled=downloading;
    }
    async function draw(){
      const data=await pack.status();
      if(!live())return;
      const estimate=data.originBytes===null?data.mediaBytes:data.originBytes;
      const percent=Math.min(100,Math.round(estimate/100000000*100));
      fill.style.width=percent+'%';meter.setAttribute('aria-valuenow',String(percent));
      usage.textContent=data.main+'/15 main · '+data.shorts+'/50 Shorts · '+mb(data.mediaBytes)+
        ' of 95 MB video budget'+(data.originBytes===null
          ? ' · Device usage estimate unavailable'
          : ' · '+mb(data.originBytes)+' estimated total app storage');
      list.replaceChildren();
      if(!data.items.length)list.append(el('p','offline-pack-empty','No downloaded videos yet. Offline games, stories and picture books remain available.'));
      for(const item of data.items){
        const row=el('div','offline-pack-item'),details=el('span','offline-pack-details');
        details.append(el('strong',null,item.title),
          el('small',null,(item.kind==='short'?'Short':'Main video')+' · '+mb(item.bytes)+
            (item.lastPlayedAt?' · Watched':' · Not watched')));
        const play=el('button','offline-pack-play','Play');play.type='button';
        play.setAttribute('aria-label','Play downloaded '+item.title);
        play.onclick=async()=>{
          play.disabled=true;
          try{
            const blob=await pack.get(item.id);
            if(!live()||!blob)throw Error('Downloaded file missing');
            stop();player.replaceChildren();
            objectURL=URL.createObjectURL(blob);
            activeVideo=el('video','offline-pack-video');activeVideo.controls=true;
            activeVideo.playsInline=true;activeVideo.preload='metadata';
            activeVideo.src=objectURL;activeVideo.setAttribute('aria-label',item.title);
            activeVideo.addEventListener('play',()=>pack.markPlayed(item.id).catch(()=>{}),{once:true});
            player.append(activeVideo);
            player.scrollIntoView({behavior:'smooth',block:'nearest'});
            activeVideo.play().catch(()=>{
              if(live())message.textContent='Tap Play to start the saved video.';
            });
          }catch(error){if(live())message.textContent=String(error.message||error);}
          finally{play.disabled=false;}
        };
        const remove=el('button','offline-pack-remove','Remove');remove.type='button';
        remove.setAttribute('aria-label','Remove downloaded '+item.title);
        remove.onclick=async()=>{
          stop();player.replaceChildren();
          try{await pack.remove(item.id);await draw();}
          catch(error){if(live())message.textContent=String(error.message||error);}
        };
        row.append(details,play,remove);list.append(row);
      }
      buttons();
    }
    async function run(mode){
      if(downloading||!available.length)return;
      const sizeNote=mode==='starter'?'up to 5 main + 15 Shorts':'up to 2 main + 5 Shorts';
      if(!window.confirm('Save '+sizeNote+' of owned/licensed videos to this phone? This uses internet data and local storage.'))return;
      try { await navigator.storage?.persist?.(); } catch (_) {}
      downloading=true;buttons();
      message.textContent=mode==='starter'?'Downloading the first small batch…':'Downloading the next small batch…';
      try{
        const result=await pack.download({mode});
        if(!live())return;
        message.textContent=result.message||(result.cancelled?'Download cancelled. Saved files are kept.':
          'Saved '+result.count+' video(s).'+(result.evicted?' Removed '+result.evicted+' older files.':''));
      }catch(error){if(live())message.textContent=String(error.message||error);}
      finally{downloading=false;if(live())await draw();}
    }
    starter.onclick=()=>run('starter');more.onclick=()=>run('next');
    cancel.onclick=()=>{pack.cancel();message.textContent='Stopping download…';};
    clear.onclick=async()=>{
      if(!window.confirm('Delete all downloaded original videos from this phone? Offline games will remain.'))return;
      stop();player.replaceChildren();
      try{await pack.clear();if(live()){message.textContent='Downloaded videos removed.';await draw();}}
      catch(error){if(live())message.textContent=String(error.message||error);}
    };
    toggle.onchange=()=>{
      if(toggle.checked && !window.confirm('Allow small automatic original-video downloads when KidLite is open and Wi-Fi is detected?')){
        toggle.checked=false;return;
      }
      pack.enableWifiAuto(toggle.checked);
      message.textContent=toggle.checked
        ? 'Wi-Fi auto-updates enabled. Runs only while this app is open and the browser detects Wi-Fi.'
        : 'Wi-Fi auto-updates turned off.';
      if(toggle.checked)pack.maybeWifiSync().then(draw).catch(()=>{});
    };
    progressListener=event=>{
      if(live()&&event.detail.active){
        const d=event.detail;
        message.textContent='Saving '+Math.min(d.done+1,d.total)+' / '+d.total+': '+d.title;
      }
    };
    window.addEventListener('kidlite:offline-pack-progress',progressListener);
    buttons();
    try{
      await draw();
      if(!live())return;
      if(navigator.onLine===false){
        message.textContent='Offline mode: saved original videos can play without data.';
        return;
      }
      available=await pack.manifest();
      if(!live())return;
      hasManifest=true;
      message.textContent=available.length
        ? available.length+' verified original videos are available to download.'
        : 'No rights-cleared originals uploaded yet. YouTube videos cannot be downloaded for offline playback.';
      buttons();
      if(toggle.checked)pack.maybeWifiSync().then(draw).catch(()=>{});
    }catch(error){
      if(live())message.textContent='Cannot refresh original video catalogue. Saved downloads are still available.';
      buttons();
    }
  }
  window.KidLiteOfflinePackUI={render,dispose};
})();
