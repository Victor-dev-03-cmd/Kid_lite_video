/* Immersive Shorts: fullscreen portrait, single YouTube iframe, unobtrusive edge swipes.
   Embedded YouTube owns touches on its playback surface. Never cover that surface. */
(function () {
  'use strict';
  const approved = new Set(['chuchutamil','pattampoochi','infobellstamil',
    'shemarootamil','chuttykannamma','kidstvtamil','cocomelon','kidschannel',
    'bumblezoop','bachpankiduniya','bibotoys']);
  let active = null;

  let youtubeApiPromise=null;
  function youtubeEmbed(id, nativeControls=false){
    const params=new URLSearchParams({
      enablejsapi:'1',origin:location.origin,playsinline:'1',autoplay:'1',rel:'0',
      controls:nativeControls?'1':'0',fs:nativeControls?'1':'0',cc_load_policy:'0'
    });
    return 'https://www.youtube-nocookie.com/embed/'+id+'?'+params;
  }
  function loadYouTubeAPI(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(youtubeApiPromise)return youtubeApiPromise;
    youtubeApiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{
        if(typeof previous==='function')try{previous();}catch(_){}
        if(window.YT?.Player)resolve(window.YT);
        else reject(new Error('YouTube API not available'));
      };
      const script=document.createElement('script');
      script.src='https://www.youtube.com/iframe_api';
      script.async=true;
      script.onerror=()=>reject(new Error('YouTube Player API did not load'));
      document.head.appendChild(script);
    }).catch(error=>{
      youtubeApiPromise=null;throw error;
    });
    return youtubeApiPromise;
  }
  function mediaPoster(video){
    // One lightweight browser-managed image, NOT a cached video download.
    return 'https://i.ytimg.com/vi/'+video.id+'/mqdefault.jpg';
  }
  function prepareNear(s){
    s.virtualWindow={
      previous:s.items[s.index-1]||null,
      current:s.items[s.index]||null,
      next:s.items[s.index+1]||null
    };
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const slow=connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType||'');
    if(slow)return;
    // Preload at most TWO small thumbnails. Do not pre-create background YouTube iframes.
    for(const v of [s.items[s.index+1],s.items[s.index+2]]){
      if(!v || s.preparedThumbnails.has(v.id))continue;
      if(s.preparedThumbnails.size>=5)s.preparedThumbnails.clear();
      s.preparedThumbnails.add(v.id);
      const image=new Image();
      image.decoding='async';
      image.src=mediaPoster(v);
    }
  }
  function refreshPauseButton(s){
    if(!s?.pauseButton)return;
    const ready=s.playerReady && !s.playerFailed;
    s.pauseButton.hidden=!!s.playerFailed;
    s.pauseButton.disabled=!ready;
    const paused=s.playbackState!==1;
    s.pauseButton.textContent=paused?'▶':'Ⅱ';
    s.pauseButton.setAttribute('aria-label',paused?'Play Short':'Pause Short');
    s.pauseButton.title=paused?'Play':'Pause';
    s.pauseButton.setAttribute('aria-pressed',String(!paused));
  }
  function togglePlayback(){
    const s=active;
    if(!s || !s.playerReady || s.playerFailed || !s.player)return;
    try{
      const state=typeof s.player.getPlayerState==='function'
        ? s.player.getPlayerState():s.playbackState;
      if(state===1){
        s.player.pauseVideo();
        s.playbackState=2;
      }else{
        s.player.playVideo();
        s.playbackState=1;
      }
      refreshPauseButton(s);
    }catch(_){
      s.description.textContent='Playback is controlled by YouTube on this device.';
    }
  }
  function activateNativeControls(s){
    // Fail safely: retain usable official YouTube controls if its JS API cannot initialize.
    if(active!==s || !s.frame)return;
    s.playerFailed=true;
    s.playerReady=false;
    clearTimeout(s.apiWatchdog);
    s.frame.src=youtubeEmbed(s.requestedId||s.initialId,true);
    // When the API cannot handle autoplay, allow the child to use the native
    // fallback controls rather than trapping playback behind the swipe layer.
    if(s.swipeSurface)s.swipeSurface.style.pointerEvents='none';
    refreshPauseButton(s);
    s.description.textContent='Native YouTube playback controls are available.';
  }

  function disposePlayer(s){
    try{s.player?.destroy();}catch(_){}
    clearTimeout(s.apiWatchdog);
    s.player=null;s.frame=null;s.playerReady=false;s.playerPending=false;
    s.playbackState=-1;
  }
  function attachApi(s){
    if(s.playerPending||s.playerReady)return;
    s.playerPending=true;
    // Degrade to one normal iframe if the IFrame API is unavailable on this device.
    s.apiWatchdog=setTimeout(()=>{
      if(active!==s || s.playerReady || !s.frame)return;
      activateNativeControls(s);
    },5000);
    loadYouTubeAPI().then(YT=>{
      if(active!==s||!s.frame?.isConnected)return;
      try{
        s.player=new YT.Player(s.frame,{
          events:{
            onReady:event=>{
              if(active!==s)return;
              s.player=event.target;s.playerReady=true;s.playerFailed=false;
              if(s.swipeSurface)s.swipeSurface.style.pointerEvents='auto';
              clearTimeout(s.apiWatchdog);
              refreshPauseButton(s);
              if(s.requestedId!==s.initialId && typeof s.player.loadVideoById==='function'){
                s.player.loadVideoById(s.requestedId);
              }
            },
            onStateChange:event=>{
              if(active!==s)return;
              s.playbackState=event.data;
              refreshPauseButton(s);
              if(event.data===YT.PlayerState.PLAYING){
                s.holder?.classList.remove('shorts-buffering');
                s.holder?.style.removeProperty('background-image');
                s.playbackStartMs=Date.now()-s.lastVideoSwitchAt;
              }else if(event.data===YT.PlayerState.BUFFERING){
                s.holder?.classList.add('shorts-buffering');
              }
            },
            onAutoplayBlocked:()=>{
              if(active===s && !s.playerFailed)activateNativeControls(s);
            },
            onError:()=>{
              if(active===s)s.description.textContent='This YouTube Short could not play.';
            }
          }
        });
      }catch(_){activateNativeControls(s);}
    }).catch(()=>{if(active===s)activateNativeControls(s);});
  }

  const SEEN_KEY='kidlite.shorts.shown.v1';
  function seenHistory(){
    try{
      const a=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]');
      return Array.isArray(a)?a.filter(id=>typeof id==='string'&&/^[\w-]{11}$/.test(id)).slice(-600):[];
    }catch(_){return [];}
  }
  function markShown(id){
    const items=seenHistory().filter(x=>x!==id);
    items.push(id);
    try{localStorage.setItem(SEEN_KEY,JSON.stringify(items.slice(-600)));}catch(_){}
  }

  function valid(v) {
    return v && /^[\w-]{11}$/.test(v.id || '') &&
      approved.has(v.channelKey) && typeof v.title === 'string' && typeof v.channel === 'string';
  }
  function close() {
    if (!active) return;
    const session = active;
    active = null;
    session.controller.abort();
    disposePlayer(session);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('fullscreenchange', fullscreenChange);
    // Removing the iframe prevents audio continuing behind the Home view.
    session.overlay.remove();
    document.body.classList.remove('shorts-open');
    if (document.fullscreenElement === session.overlay && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    session.onExit?.();
  }
  function fullscreenChange() {
    if (active && active.enteredFullscreen && !document.fullscreenElement) close();
  }
  function navigate(delta) {
    const s=active;
    if(!s||!s.items.length||Date.now()-s.lastSwitch<300)return;
    const next=s.index+delta;
    if(next>=0&&next<s.items.length){
      s.lastSwitch=Date.now();s.index=next;render();
    }else if(delta>0&&s.hasMore){
      s.pendingNext=true;loadNext(s);
    }else if(delta>0){
      caughtUp(s);
    }
  }
  function onKeyDown(event) {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault(); close();
    } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault(); navigate(1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault(); navigate(-1);
    } else if(event.key===' ' || event.key==='k' || event.key==='K'){
      event.preventDefault();togglePlayback();
    }
  }
  function makeRail(side) {
    const rail = document.createElement('div');
    rail.className = 'shorts-swipe-rail shorts-rail-' + side;
    rail.setAttribute('role','region');
    rail.setAttribute('aria-label','Swipe vertically for previous or next Short');
    const movement = {pointer:null,startY:0,startX:0,suppressClick:false};
    rail.addEventListener('pointerdown',event => {
      if (event.isPrimary === false) return;
      movement.pointer = event.pointerId;
      movement.startY = event.clientY;
      movement.startX = event.clientX;
      movement.suppressClick = false;
      try {rail.setPointerCapture(event.pointerId);} catch (_) {}
    });
    rail.addEventListener('pointerup',event => {
      if (movement.pointer !== event.pointerId) return;
      movement.pointer = null;
      const dy = event.clientY - movement.startY, dx = event.clientX - movement.startX;
      if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx)) {
        movement.suppressClick = true;
        navigate(dy < 0 ? 1 : -1);
      }
    });
    rail.addEventListener('pointercancel',()=>{movement.pointer=null;});
    if (!('PointerEvent' in window)) {
      let origin = null;
      rail.addEventListener('touchstart',event => {
        if (event.touches.length === 1) origin = event.touches[0].clientY;
      },{passive:true});
      rail.addEventListener('touchend',event => {
        if (origin === null || !event.changedTouches.length) return;
        const delta = event.changedTouches[0].clientY - origin;
        origin = null;
        if (Math.abs(delta) > 28) {movement.suppressClick=true; navigate(delta < 0 ? 1 : -1);}
      },{passive:true});
    }
    // Rail is gesture-only, with no extra buttons or tap actions.
    return rail;
  }
  function render(){
    const s=active;
    if(!s||!s.items.length)return;
    if(s.swipeSurface)s.swipeSurface.style.pointerEvents=s.playerFailed?'none':'auto';
    const video=s.items[s.index];
    prepareNear(s);
    s.lastVideoSwitchAt=Date.now();
    s.requestedId=video.id;
    s.playbackState=-1;
    if(s.pauseButton)s.pauseButton.hidden=false;
    refreshPauseButton(s);
    if(!s.holder || !s.frame?.isConnected){
      s.slot.replaceChildren(); // Initial creation only, NOT on each swipe.
      const holder=document.createElement('div');
      holder.className='shorts-player shorts-buffering';
      holder.style.backgroundImage='url("'+mediaPoster(video)+'")';
      const frame=document.createElement('iframe');
      frame.id='kidlite-shorts-youtube-player';
      frame.src=youtubeEmbed(video.id);
      frame.title=video.title+' · '+video.channel+' · YouTube';
      frame.allow='autoplay; encrypted-media; gyroscope; accelerometer; picture-in-picture; fullscreen';
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.allowFullscreen=true;
      frame.loading='eager';
      holder.append(frame);
      s.holder=holder;s.frame=frame;s.initialId=video.id;
      s.slot.append(holder);
      attachApi(s);
    }else{
      s.holder.classList.add('shorts-buffering');
      // Poster is the PLAYER BACKGROUND only; it does not cover the YouTube iframe/UI.
      s.holder.style.backgroundImage='url("'+mediaPoster(video)+'")';
      if(s.playerReady && typeof s.player?.loadVideoById==='function'){
        try{s.player.loadVideoById(video.id);}catch(_){activateNativeControls(s);}
      }else if(s.playerFailed){
        // When YouTube JS API is blocked, retain one iframe and update only its URL.
        s.frame.src=youtubeEmbed(video.id,true);
      }
      // During initial API bootstrap, onReady loads s.requestedId, not another iframe.
    }
    s.description.textContent=(s.index+1)+' · '+video.title+' · '+video.channel;
    markShown(video.id);
    if(s.hasMore && s.items.length-s.index<=4)loadNext(s);
  }
  function showMessage(s, message, retry = false) {
    // Let the user tap Retry / Replay when a clip is unavailable or exhausted.
    if(s.swipeSurface)s.swipeSurface.style.pointerEvents=retry?'none':'auto';
    disposePlayer(s);
    s.holder=null;
    if(s.pauseButton)s.pauseButton.hidden=true;
    s.slot.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'shorts-message';
    const text = document.createElement('p'); text.textContent = message;
    panel.append(text);
    if (retry) {
      const button = document.createElement('button');
      button.className = 'shorts-retry';
      button.type = 'button';
      button.textContent = 'Retry';
      button.onclick = () => loadNext(s);
      panel.append(button);
    }
    s.slot.append(panel);
    s.description.textContent = message;
  }
  function caughtUp(s){
    if(active!==s)return;
    s.pendingNext=false;
    showMessage(s,'All currently available Shorts have been shown. Check back when these channels upload new clips.',true);
    const button=s.slot.querySelector('.shorts-retry');
    if(button){
      button.textContent='Replay watched Shorts';
      button.onclick=()=>{
        try{localStorage.removeItem(SEEN_KEY);}catch(_){}
        s.controller.abort();s.controller=new AbortController();
        s.items=[];s.ids=new Set();s.page=0;s.index=0;
        s.hasMore=true;s.loading=null;s.pendingNext=false;s.lastSwitch=0;
        s.sessionSeed=window.KidLiteFreshness?.createSeed() || Date.now();
        showMessage(s,'Loading Shorts…');loadNext(s);
      };
    }
  }
  async function loadNext(s){
    if(active!==s||s.loading)return s.loading;
    if(!s.hasMore){if(!s.items.length||s.pendingNext)caughtUp(s);return;}
    s.loading=(async()=>{
      try{
        let added=0;
        // Look ahead through approved batches without recycling already shown IDs.
        while(active===s&&s.hasMore&&added===0){
          const params=new URLSearchParams({
            kind:'short',channel:'all',age:s.age,page:String(s.page)
          });
          const response=await fetch('/api/videos?'+params,{
            signal:s.controller.signal,cache:'default'
          });
          if(!response.ok)throw Error('Shorts API unavailable');
          const data=await response.json();
          if(active!==s)return;
          const seen=new Set(seenHistory());
          const batch=Array.isArray(data.videos)?data.videos:[];
          // Each session shuffles the still-unseen approved Shorts, without changing
          // the API URL or forcing new YouTube quota on each opening.
          const randomBatch=window.KidLiteFreshness
            ? window.KidLiteFreshness.shuffle(batch,(s.sessionSeed^((s.page+1)*2654435761))>>>0)
            : batch;
          for(const v of randomBatch){
            if(!valid(v)||seen.has(v.id)||s.ids.has(v.id))continue;
            s.ids.add(v.id);s.items.push(v);added++;
          }
          s.page=Number.isInteger(data.nextPage)?data.nextPage:s.page+1;
          s.hasMore=Boolean(data.hasMore)&&s.page<=11;
        }
        if(active!==s)return;
        if(!s.items.length){caughtUp(s);return;}
        if(s.index===0&&!s.slot.querySelector('iframe')){render();return;}
        if(s.pendingNext){
          s.pendingNext=false;
          if(s.index+1<s.items.length){
            s.lastSwitch=Date.now();s.index++;render();
          }else if(!s.hasMore)caughtUp(s);
        }
      }catch(error){
        if(active!==s||error?.name==='AbortError')return;
        if(!s.items.length)showMessage(s,'Could not fetch Shorts. Connect to the internet and retry.',true);
        else s.description.textContent='More Shorts are temporarily unavailable.';
      }finally{if(active===s)s.loading=null;}
    })();
    return s.loading;
  }
  function open(options={}) {
    if (active) return;
    const overlay = document.createElement('section');
    overlay.className = 'shorts-overlay'; overlay.id = 'shorts-viewer';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Fullscreen YouTube Shorts');
    const back = document.createElement('button');
    back.type='button';back.className='shorts-back';
    back.replaceChildren(window.KidLiteIconsax?.create('arrow-left',24) || document.createTextNode('←'));
    back.setAttribute('aria-label','Back to home');
    back.onclick=close;
    // Kid-only viewing mode: no extra Play/Pause button obscures the portrait video.
    const stage=document.createElement('div');stage.className='shorts-stage';
    const slot=document.createElement('div');slot.className='shorts-video-slot';
    stage.append(makeRail('left'),slot,makeRail('right'));
    // Extra gesture surface: the black area above/below the centred video.
    // YouTube's iframe itself is never covered or intercepted.
    let outerStart = null;
    slot.addEventListener('pointerdown',event=>{
      if(event.target!==slot || event.isPrimary===false)return;
      outerStart={id:event.pointerId,y:event.clientY,x:event.clientX};
      try {slot.setPointerCapture(event.pointerId);}catch(_){}
    });
    slot.addEventListener('pointerup',event=>{
      if(!outerStart || event.pointerId!==outerStart.id)return;
      const dy=event.clientY-outerStart.y,dx=event.clientX-outerStart.x;
      outerStart=null;
      if(Math.abs(dy)>30 && Math.abs(dy)>Math.abs(dx))navigate(dy<0?1:-1);
      // Touching the app border without swiping does not alter playback.
    });
    slot.addEventListener('pointercancel',()=>{outerStart=null;});
    if(!('PointerEvent' in window)){
      let from=null;
      slot.addEventListener('touchstart',event=>{
        if(event.target===slot && event.touches.length===1)from=event.touches[0].clientY;
      },{passive:true});
      slot.addEventListener('touchend',event=>{
        if(from===null||!event.changedTouches.length)return;
        const delta=event.changedTouches[0].clientY-from;from=null;
        if(Math.abs(delta)>30)navigate(delta<0?1:-1);
        // Only vertical swipes navigate Shorts.
      },{passive:true});
    }
    // Kids-first fullscreen gesture surface: a vertical swipe can begin
    // anywhere over the visible Short. Tapping is intentionally a no-op.
    const swipeSurface=document.createElement('div');
    swipeSurface.className='shorts-full-swipe-surface';
    swipeSurface.setAttribute('role','region');
    swipeSurface.setAttribute('aria-label','Swipe up for next Short, down for previous Short');
    const gesture={pointerId:null,startX:0,startY:0};
    swipeSurface.addEventListener('pointerdown',event=>{
      if(event.isPrimary===false)return;
      gesture.pointerId=event.pointerId;
      gesture.startX=event.clientX;
      gesture.startY=event.clientY;
      try{swipeSurface.setPointerCapture(event.pointerId);}catch(_){}
    });
    swipeSurface.addEventListener('pointerup',event=>{
      if(gesture.pointerId!==event.pointerId)return;
      const dy=event.clientY-gesture.startY;
      const dx=event.clientX-gesture.startX;
      gesture.pointerId=null;
      if(Math.abs(dy)>=40 && Math.abs(dy)>Math.abs(dx)*1.2){
        navigate(dy<0?1:-1);
      }
    });
    swipeSurface.addEventListener('pointercancel',()=>{gesture.pointerId=null;});
    // Legacy Safari fallback only when Pointer Events are unavailable.
    if(!('PointerEvent' in window)){
      let first=null;
      swipeSurface.addEventListener('touchstart',event=>{
        if(event.touches.length===1){
          first={x:event.touches[0].clientX,y:event.touches[0].clientY};
        }
      },{passive:true});
      swipeSurface.addEventListener('touchend',event=>{
        if(!first || !event.changedTouches.length)return;
        const dy=event.changedTouches[0].clientY-first.y;
        const dx=event.changedTouches[0].clientX-first.x;
        first=null;
        if(Math.abs(dy)>=40 && Math.abs(dy)>Math.abs(dx)*1.2){
          navigate(dy<0?1:-1);
        }
      },{passive:true});
      swipeSurface.addEventListener('touchcancel',()=>{first=null;},{passive:true});
    }
    const description=document.createElement('p');
    description.className='sr-only';description.setAttribute('aria-live','polite');
    overlay.append(stage,swipeSurface,back,description);
    const age=['all','2-5','6-9','10-12'].includes(options.age)?options.age:'all';
    const s={overlay,slot,description,swipeSurface,age,controller:new AbortController(),
      items:[],ids:new Set(),index:0,page:0,hasMore:true,loading:null,pendingNext:false,
      lastSwitch:0,onExit:options.onExit,enteredFullscreen:false,
      player:null,frame:null,holder:null,playerReady:false,playerPending:false,
      playerFailed:false,requestedId:null,initialId:null,lastVideoSwitchAt:0,
      playbackStartMs:0,preparedThumbnails:new Set(),virtualWindow:null,apiWatchdog:null,
      pauseButton:null,playbackState:-1,
      sessionSeed:window.KidLiteFreshness?.createSeed() || Date.now()};
    active=s;
    let lastWheel=0;
    overlay.addEventListener('wheel',event=>{
      if(Math.abs(event.deltaY)<24)return;
      event.preventDefault();
      if(Date.now()-lastWheel<480)return;
      lastWheel=Date.now();navigate(event.deltaY>0?1:-1);
    },{passive:false});
    document.body.append(overlay);
    document.body.classList.add('shorts-open');
    document.addEventListener('keydown',onKeyDown);
    document.addEventListener('fullscreenchange',fullscreenChange);
    back.focus();
    // Called synchronously in the Shorts button gesture where supported.
    // Unsupported on some iOS browsers; installed PWA uses manifest display mode.
    if(overlay.requestFullscreen) {
      try {
        overlay.requestFullscreen({navigationUI:'hide'}).then(()=>{
          if(active===s)s.enteredFullscreen=true;
        }).catch(()=>{});
      } catch (_) {}
    }
    // Start fetching the API script in parallel with the approved metadata request.
    loadYouTubeAPI().catch(()=>{});
    showMessage(s,'Loading fresh Shorts…');
    loadNext(s);
  }
  window.KidLiteShorts={open,close,get isOpen(){return !!active;}};
})();
