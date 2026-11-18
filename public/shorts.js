/* Full-viewport Shorts viewer: one YouTube iframe at a time, no list or extra play cards.
   On mobile, swipe from the margins around the YouTube player. Browser events inside
   a third-party iframe cannot be intercepted without obstructing its controls. */
(function () {
  'use strict';

  const allowedChannels = new Set([
    'chuchutamil','pattampoochi','infobellstamil','shemarootamil',
    'chuttykannamma','kidstvtamil','cocomelon','kidschannel'
  ]);
  const responseCache = new Map();
  let current = null;

  function valid(video) {
    return video && typeof video.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(video.id) &&
      allowedChannels.has(video.channelKey) &&
      typeof video.title === 'string' && typeof video.channel === 'string';
  }

  function close() {
    if (!current) return;
    const session = current;
    current = null;
    session.abort.abort();
    document.removeEventListener('keydown', onKeys);
    session.overlay.remove(); // destroy iframe to stop audio/video immediately
    document.body.classList.remove('shorts-open');
    if (typeof session.onExit === 'function') session.onExit();
  }

  function navigate(direction) {
    if (!current || !current.items.length) return;
    const next = current.index + direction;
    if (next < 0 || next >= current.items.length) return;
    current.index = next;
    renderItem();
  }

  function onKeys(event) {
    if (!current || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault(); close();
    } else if (['ArrowDown','PageDown',' '].includes(event.key)) {
      event.preventDefault(); navigate(1);
    } else if (['ArrowUp','PageUp'].includes(event.key)) {
      event.preventDefault(); navigate(-1);
    }
  }

  function toolbar() {
    const bar = document.createElement('div');
    bar.className = 'shorts-toolbar';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'shorts-back';
    back.textContent = '←';
    back.setAttribute('aria-label','Back to videos');
    back.onclick = close;

    const attribution = document.createElement('span');
    attribution.className = 'shorts-attribution';
    attribution.innerHTML = '<svg viewBox="0 0 24 18" aria-hidden="true"><rect x="1" y="1" width="22" height="16" rx="5" fill="#ff3f45"/><path d="m10 5 7 4-7 4z" fill="white"/></svg><span>YouTube Shorts</span>';
    bar.append(back, attribution);
    return bar;
  }

  function setMessage(message, canRetry) {
    if (!current) return;
    const stage = current.stage;
    stage.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.className = 'shorts-message';
    const para = document.createElement('p'); para.textContent = message;
    wrapper.append(para);
    if (canRetry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shorts-retry';
      button.textContent = 'Retry';
      button.onclick = () => load(current.age);
      wrapper.append(button);
    }
    stage.append(wrapper);
  }

  function renderItem() {
    const session = current;
    if (!session || !session.items.length) return;
    const video = session.items[session.index];
    session.stage.replaceChildren(); // only ONE heavy iframe at a time
    const player = document.createElement('div');
    player.className = 'shorts-player';
    const frame = document.createElement('iframe');
    frame.title = video.title + ' — ' + video.channel + ' — YouTube';
    frame.src = 'https://www.youtube-nocookie.com/embed/' + video.id +
      '?playsinline=1&autoplay=1&rel=0';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'autoplay; encrypted-media; gyroscope; accelerometer; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.loading = 'eager';
    player.append(frame);
    session.stage.append(player);
    session.description.textContent = video.title + ' · ' + video.channel +
      ' · ' + (session.index + 1) + ' of ' + session.items.length;
  }

  function setupGestures(session) {
    let startY = null;
    let lastWheel = 0;
    // Touch gestures work on outer margins; YouTube owns touches inside its iframe.
    session.overlay.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      if (event.target.closest('button')) return;
      startY = event.touches[0].clientY;
    }, {passive:true});
    session.overlay.addEventListener('touchend', event => {
      if (startY === null || !event.changedTouches.length) return;
      const delta = event.changedTouches[0].clientY - startY;
      startY = null;
      if (Math.abs(delta) > 48) navigate(delta < 0 ? 1 : -1);
    }, {passive:true});
    session.overlay.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) < 20) return;
      event.preventDefault();
      const now = Date.now();
      if (now - lastWheel < 650) return;
      lastWheel = now;
      navigate(event.deltaY > 0 ? 1 : -1);
    }, {passive:false});
  }

  async function load(age) {
    if (!current) return;
    const session = current;
    session.abort.abort();
    session.abort = new AbortController();
    setMessage('Loading Shorts…', false);
    try {
      const key = age;
      const saved = responseCache.get(key);
      let payload;
      if (saved && Date.now() < saved.expires) {
        payload = saved.data;
      } else {
        const params = new URLSearchParams({kind:'short',channel:'all',age});
        const response = await fetch('/api/videos?' + params, {signal:session.abort.signal});
        if (!response.ok) throw new Error('Could not load Shorts');
        payload = await response.json();
        responseCache.set(key, {data:payload,expires:Date.now() + 5*60*1000});
      }
      if (current !== session) return;
      const entries = Array.isArray(payload.videos) ? payload.videos.filter(valid) : [];
      session.items = entries.slice(0,30);
      session.index = 0;
      if (!session.items.length) {
        setMessage(payload.notice || 'No Shorts found for this selection.', true);
        return;
      }
      renderItem();
    } catch (error) {
      if (current !== session || error?.name === 'AbortError') return;
      setMessage('Unable to load Shorts. Please check your internet connection.', true);
    }
  }

  function open(options = {}) {
    if (current) return;
    const age = ['all','2-5','6-9','10-12'].includes(options.age) ? options.age : 'all';
    const overlay = document.createElement('section');
    overlay.id = 'shorts-viewer';
    overlay.className = 'shorts-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','YouTube Shorts viewer');
    const top = toolbar();
    const stage = document.createElement('div');
    stage.className = 'shorts-stage';
    const description = document.createElement('p');
    description.className = 'sr-only';
    description.setAttribute('aria-live','polite');
    // No overlays obscure YouTube player controls.
    overlay.append(top, stage, description);
    current = {
      overlay,stage,description,items:[],index:0,age,
      abort:new AbortController(),onExit:options.onExit
    };
    setupGestures(current);
    document.body.append(overlay);
    document.body.classList.add('shorts-open');
    document.addEventListener('keydown', onKeys);
    top.querySelector('button')?.focus();
    load(age);
  }

  window.KidLiteShorts = {open, close, get isOpen(){return Boolean(current);}};
})();
