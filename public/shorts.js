/* KidLite Shorts: ONE active YouTube iframe, with mobile-friendly side swipe rails.
 * Cross-origin YouTube iframe gestures stay YouTube's; the rails never cover controls. */
(function () {
  'use strict';

  const approved = new Set([
    'chuchutamil','pattampoochi','infobellstamil','shemarootamil',
    'chuttykannamma','kidstvtamil','cocomelon','kidschannel'
  ]);
  const cached = new Map();
  let active = null;

  function valid(v) {
    return v && typeof v.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.id) &&
      approved.has(v.channelKey) && typeof v.title === 'string' && typeof v.channel === 'string';
  }

  function close() {
    if (!active) return;
    const session = active;
    active = null;
    session.request.abort();
    document.removeEventListener('keydown', onKeyDown);
    // Removing the only YouTube iframe immediately stops audio.
    session.overlay.remove();
    document.body.classList.remove('shorts-open');
    if (typeof session.onExit === 'function') session.onExit();
  }

  function navigate(delta) {
    const s = active;
    if (!s || s.items.length === 0) return;
    const next = Math.min(s.items.length - 1, Math.max(0, s.index + delta));
    if (next === s.index) return;
    if (Date.now() - s.lastSwitch < 230) return; // prevent burst-swipes constructing players
    s.lastSwitch = Date.now();
    s.index = next;
    render();
  }

  function onKeyDown(event) {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault();
      close();
    } else if (['ArrowDown','PageDown'].includes(event.key)) {
      event.preventDefault(); navigate(1);
    } else if (['ArrowUp','PageUp'].includes(event.key)) {
      event.preventDefault(); navigate(-1);
    }
  }

  function makeRail(side) {
    const rail = document.createElement('div');
    rail.className = 'shorts-swipe-rail shorts-rail-' + side;
    rail.setAttribute('aria-label', 'Swipe up or down for another Short');
    rail.title = 'Swipe up or down here';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shorts-skip';
    button.textContent = side === 'left' ? '↑' : '↓';
    button.setAttribute('aria-label', side === 'left' ? 'Previous Short' : 'Next Short');
    button.onclick = () => navigate(side === 'left' ? -1 : 1);
    rail.append(button);

    let start = null;
    rail.addEventListener('pointerdown', event => {
      if (event.isPrimary === false || event.target.closest('button')) return;
      start = {id:event.pointerId, y:event.clientY, x:event.clientX};
      if (rail.setPointerCapture) {
        try {rail.setPointerCapture(event.pointerId);} catch (_) {}
      }
    });
    rail.addEventListener('pointerup', event => {
      if (!start || event.pointerId !== start.id) return;
      const distanceY = event.clientY - start.y;
      const distanceX = event.clientX - start.x;
      start = null;
      if (Math.abs(distanceY) > 35 && Math.abs(distanceY) > Math.abs(distanceX)) {
        navigate(distanceY < 0 ? 1 : -1);
      }
    });
    rail.addEventListener('pointercancel', () => {start=null;});
    // Legacy iPad Safari before Pointer Events support.
    if (!('PointerEvent' in window)) {
      let touchStart=null;
      rail.addEventListener('touchstart', event => {
        if (event.touches.length !== 1 || event.target.closest('button')) return;
        touchStart=event.touches[0].clientY;
      },{passive:true});
      rail.addEventListener('touchend', event => {
        if (touchStart === null || !event.changedTouches.length) return;
        const distance=event.changedTouches[0].clientY-touchStart;
        touchStart=null;
        if(Math.abs(distance)>35) navigate(distance < 0 ? 1 : -1);
      },{passive:true});
    }
    rail.addEventListener('click', event => {
      // Tapping either large rail is a fallback for phones where swiping is unreliable.
      if (event.target.closest('button')) return;
      if (event.detail === 0) return;
      navigate(side === 'left' ? -1 : 1);
    });
    return {rail,button};
  }

  function render() {
    const s = active;
    if (!s || !s.items.length) return;
    const video = s.items[s.index];
    // One iframe only: replacing the prior node stops playback and memory usage.
    s.slot.replaceChildren();
    const holder = document.createElement('div');
    holder.className = 'shorts-player';
    const iframe = document.createElement('iframe');
    iframe.title = video.title + ' — ' + video.channel + ' — YouTube';
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + video.id + '?playsinline=1&autoplay=1&rel=0';
    iframe.allow = 'autoplay; encrypted-media; gyroscope; accelerometer; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.loading = 'eager';
    holder.append(iframe);
    s.slot.append(holder);
    s.counter.textContent = (s.index + 1) + ' / ' + s.items.length;
    s.description.textContent = video.title + ', ' + video.channel;
    s.previous.disabled = s.index === 0;
    s.next.disabled = s.index >= s.items.length - 1;

    // Do not prefetch another thumbnail or player: saves bandwidth on mobile networks.
  }

  function message(s, text, retry) {
    s.slot.replaceChildren();
    const box = document.createElement('div');
    box.className = 'shorts-message';
    const textNode = document.createElement('p'); textNode.textContent = text;
    box.append(textNode);
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shorts-retry';
      button.textContent = 'Retry';
      button.onclick = () => fetchVideos(s);
      box.append(button);
    }
    s.slot.append(box);
    s.previous.disabled = true;
    s.next.disabled = true;
    s.counter.textContent = '';
  }

  async function fetchVideos(s) {
    if (active !== s) return;
    s.request.abort();
    s.request = new AbortController();
    message(s, 'Loading Shorts…', false);
    try {
      const saved = cached.get(s.age);
      let data;
      if (saved && Date.now() < saved.until) {
        data = saved.value;
      } else {
        const params = new URLSearchParams({kind:'short',channel:'all',age:s.age});
        const response = await fetch('/api/videos?' + params, {signal:s.request.signal});
        if (!response.ok) throw new Error('Shorts fetch failed');
        data = await response.json();
        cached.set(s.age, {value:data,until:Date.now()+3*60*1000});
      }
      if (active !== s) return;
      s.items = Array.isArray(data.videos) ? data.videos.filter(valid).slice(0,30) : [];
      s.index = 0;
      s.lastSwitch = 0;
      if (s.items.length) render();
      else message(s, data.notice || 'No Shorts found for these channels.', true);
    } catch (error) {
      if (active !== s || error?.name === 'AbortError') return;
      message(s, 'Shorts could not load. Check the internet connection.', true);
    }
  }

  function open(options = {}) {
    if (active) return;
    const age = ['all','2-5','6-9','10-12'].includes(options.age) ? options.age : 'all';
    const overlay = document.createElement('section');
    overlay.id = 'shorts-viewer';
    overlay.className = 'shorts-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','YouTube Shorts player');
    const header = document.createElement('div');
    header.className = 'shorts-toolbar';
    const back = document.createElement('button');
    back.className = 'shorts-back'; back.type = 'button';
    back.textContent = '←'; back.setAttribute('aria-label','Back to home');
    back.onclick = close;
    const source = document.createElement('span');
    source.className = 'shorts-attribution'; source.textContent = 'YouTube Shorts';
    const counter = document.createElement('span'); counter.className = 'shorts-counter';
    header.append(back,source,counter);

    const stage = document.createElement('div'); stage.className = 'shorts-stage';
    const left = makeRail('left');
    const right = makeRail('right');
    const slot = document.createElement('div'); slot.className = 'shorts-video-slot';
    stage.append(left.rail,slot,right.rail);
    const description = document.createElement('p');
    description.className = 'sr-only'; description.setAttribute('aria-live','polite');
    overlay.append(header,stage,description);
    const s = {
      overlay,slot,items:[],index:0,age,lastSwitch:0,request:new AbortController(),
      previous:left.button,next:right.button,counter,description,onExit:options.onExit
    };
    active = s;
    // Mouse-wheel navigation is throttled; no fixed scroll container is created.
    let lastWheel = 0;
    stage.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) < 20) return;
      event.preventDefault();
      if (Date.now() - lastWheel < 500) return;
      lastWheel = Date.now();
      navigate(event.deltaY > 0 ? 1 : -1);
    },{passive:false});
    document.body.append(overlay);
    document.body.classList.add('shorts-open');
    document.addEventListener('keydown',onKeyDown);
    back.focus();
    fetchVideos(s);
  }

  window.KidLiteShorts = {open,close,get isOpen(){return Boolean(active);}};
})();
