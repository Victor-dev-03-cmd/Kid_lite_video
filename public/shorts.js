/* Immersive Shorts: fullscreen portrait, single YouTube iframe, unobtrusive edge swipes.
   Embedded YouTube owns touches on its playback surface. Never cover that surface. */
(function () {
  'use strict';
  const approved = new Set(['chuchutamil','pattampoochi','infobellstamil',
    'shemarootamil','chuttykannamma','kidstvtamil','cocomelon','kidschannel']);
  let active = null;
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
    }
  }
  function makeRail(side) {
    const rail = document.createElement('div');
    rail.className = 'shorts-swipe-rail shorts-rail-' + side;
    rail.setAttribute('role','button');
    rail.tabIndex = 0;
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
    rail.addEventListener('click',()=>{
      if (movement.suppressClick) {movement.suppressClick=false;return;}
      // Tap left edge for previous, right edge for next. No visible navigation buttons.
      navigate(side === 'left' ? -1 : 1);
    });
    rail.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();navigate(side === 'left' ? -1 : 1);
      }
    });
    return rail;
  }
  function render() {
    const s = active;
    if (!s || !s.items.length) return;
    const video = s.items[s.index];
    s.slot.replaceChildren(); // exactly one heavy YouTube player
    const player = document.createElement('div');
    player.className = 'shorts-player';
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + video.id +
      '?playsinline=1&autoplay=1&rel=0';
    iframe.title = video.title + ' · ' + video.channel + ' · YouTube';
    iframe.allow = 'autoplay; encrypted-media; gyroscope; accelerometer; picture-in-picture; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    iframe.loading = 'eager';
    player.append(iframe);
    s.slot.append(player);
    s.description.textContent = (s.index + 1) + ' of ' +
      s.items.length + ' — ' + video.title + ' — ' + video.channel;
    markShown(video.id);
    if(s.hasMore && s.items.length-s.index<=4)loadNext(s);
  }
  function showMessage(s, message, retry = false) {
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
          for(const v of Array.isArray(data.videos)?data.videos:[]){
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
    back.textContent='←';back.setAttribute('aria-label','Back to home');
    back.onclick=close;
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
      },{passive:true});
    }
    const description=document.createElement('p');
    description.className='sr-only';description.setAttribute('aria-live','polite');
    overlay.append(stage,back,description);
    const age=['all','2-5','6-9','10-12'].includes(options.age)?options.age:'all';
    const s={overlay,slot,description,age,controller:new AbortController(),
      items:[],ids:new Set(),index:0,page:0,hasMore:true,loading:null,pendingNext:false,
      lastSwitch:0,onExit:options.onExit,enteredFullscreen:false};
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
    showMessage(s,'Loading fresh Shorts…');
    loadNext(s);
  }
  window.KidLiteShorts={open,close,get isOpen(){return !!active;}};
})();
