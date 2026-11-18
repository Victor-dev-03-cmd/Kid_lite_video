/* Immersive Shorts: fullscreen portrait, single YouTube iframe, unobtrusive edge swipes.
   Embedded YouTube owns touches on its playback surface. Never cover that surface. */
(function () {
  'use strict';
  const approved = new Set(['chuchutamil','pattampoochi','infobellstamil',
    'shemarootamil','chuttykannamma','kidstvtamil','cocomelon','kidschannel']);
  let active = null;
  const responseCache = new Map();

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
    const s = active;
    if (!s || s.items.length === 0 || Date.now() - s.lastSwitch < 300) return;
    const next = Math.max(0,Math.min(s.items.length - 1,s.index + delta));
    if (next === s.index) return;
    s.lastSwitch = Date.now();
    s.index = next;
    render();
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
      button.onclick = () => load(s);
      panel.append(button);
    }
    s.slot.append(panel);
    s.description.textContent = message;
  }
  async function load(s) {
    s.controller.abort();
    s.controller = new AbortController();
    showMessage(s,'Loading Shorts…');
    try {
      const cache = responseCache.get(s.age);
      let payload;
      if (cache && Date.now() < cache.expires) payload = cache.data;
      else {
        const params = new URLSearchParams({kind:'short',channel:'all',age:s.age});
        const response = await fetch('/api/videos?' + params,{
          signal:s.controller.signal,cache:'default'
        });
        if (!response.ok) throw Error('Shorts API unavailable');
        payload = await response.json();
        responseCache.set(s.age,{data:payload,expires:Date.now()+180000});
      }
      if (active !== s) return;
      s.items = Array.isArray(payload.videos) ? payload.videos.filter(valid).slice(0,30) : [];
      s.index = 0; s.lastSwitch = 0;
      if (s.items.length) render();
      else showMessage(s,payload.notice || 'No Shorts available from selected channels.',true);
    } catch (error) {
      if (active !== s || error?.name === 'AbortError') return;
      showMessage(s,'YouTube Shorts need an internet connection. Offline stories are available in Offline Play.',true);
    }
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
    const description=document.createElement('p');
    description.className='sr-only';description.setAttribute('aria-live','polite');
    overlay.append(stage,back,description);
    const age=['all','2-5','6-9','10-12'].includes(options.age)?options.age:'all';
    const s={overlay,slot,description,age,controller:new AbortController(),
      items:[],index:0,lastSwitch:0,onExit:options.onExit,enteredFullscreen:false};
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
    load(s);
  }
  window.KidLiteShorts={open,close,get isOpen(){return !!active;}};
})();
