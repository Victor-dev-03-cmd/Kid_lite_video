(function () {
  'use strict';
  const home = document.getElementById('main-view');
  const activity = document.getElementById('activity-view');
  const authScreen = document.getElementById('auth-screen');
  const dock = document.querySelector('.dock');
  const feed = document.getElementById('video-feed');
  const feedStatus = document.getElementById('feed-status');
  const search = document.getElementById('video-query');
  const age = document.getElementById('age-select');
  const channelButtons = [...document.querySelectorAll('[data-channel]')];
  const navButtons = [...document.querySelectorAll('.dock-button')];
  const state = { channel: 'all', requestNumber: 0, videos: [], shorts: [], timer: null, hasLoaded: false };

  function signedIn() { return Boolean(window.KidLiteAuth?.signedIn); }
  function setNav(view) {
    navButtons.forEach(b => {
      const active = b.dataset.view === view;
      b.classList.toggle('active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }
  function updateNav(view) {
    dock.classList.toggle('hidden', !signedIn());
    setNav(view);
  }
  function showActivity(title, render, view = 'offline', back = showHome) {
    home.classList.add('hidden');
    authScreen.classList.add('hidden');
    activity.classList.remove('hidden');
    activity.replaceChildren();
    const head = document.createElement('div');
    head.className = 'activity-header';
    const arrow = document.createElement('button');
    arrow.className = 'back-button'; arrow.type = 'button';
    arrow.textContent = '←'; arrow.setAttribute('aria-label', 'Go back');
    arrow.onclick = back;
    const heading = document.createElement('h1'); heading.textContent = title;
    head.append(arrow, heading);
    const content = document.createElement('div'); content.className = 'activity-content';
    activity.append(head, content);
    updateNav(view);
    render(content);
    window.scrollTo(0, 0);
  }
  function showHome() {
    activity.replaceChildren(); activity.classList.add('hidden');
    updateNav('home');
    if (signedIn()) {
      authScreen.classList.add('hidden');
      home.classList.remove('hidden');
      if (!state.hasLoaded) loadVideos();
    } else {
      home.classList.add('hidden');
      authScreen.classList.remove('hidden');
    }
    window.scrollTo(0, 0);
  }

  function videoCard(video) {
    const card = document.createElement('article');
    card.className = 'video-card';
    const openVideo = () => showVideo(video);
    const thumbnail = document.createElement('button');
    thumbnail.type = 'button'; thumbnail.className = 'video-thumbnail';
    thumbnail.setAttribute('aria-label', 'Play ' + video.title);
    const image = document.createElement('img');
    image.src = video.thumbnail || ('https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg');
    image.alt = '';
    image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    const play = document.createElement('span'); play.className = 'video-play';
    play.setAttribute('aria-hidden', 'true');
    play.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#fff" d="m7 3 14 9-14 9z"/></svg>';
    thumbnail.append(image, play);
    thumbnail.onclick = openVideo;
    const details = document.createElement('div'); details.className = 'video-info';
    const avatar = document.createElement('span');
    avatar.className = 'channel-avatar ' + video.channelKey;
    avatar.textContent = ({cocomelon:'🍉',kidschannel:'🚂',chuchutamil:'🎵',pattampoochi:'🦋',infobellstamil:'🌸',shemarootamil:'📚',chuttykannamma:'🌈',kidstvtamil:'🐥'})[video.channelKey] || '🎬';
    avatar.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div'); text.className = 'video-info-text';
    const title = document.createElement('button'); title.className = 'video-title'; title.type = 'button';
    title.textContent = video.title; title.onclick = openVideo;
    const sub = document.createElement('div'); sub.className = 'video-subtitle';
    const source = document.createElement('span'); source.textContent = video.channel;
    const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '·';
    const label = document.createElement('span'); label.textContent = 'YouTube';
    sub.append(source, sep, label);
    text.append(title, sub); details.append(avatar, text); card.append(thumbnail, details);
    return card;
  }
  function validVideo(v) {
    return v && typeof v.id === 'string' && /^[\w-]{11}$/.test(v.id) &&
      ['cocomelon','kidschannel','chuchutamil','pattampoochi','infobellstamil','shemarootamil','chuttykannamma','kidstvtamil'].includes(v.channelKey) &&
      typeof v.title === 'string' && typeof v.channel === 'string';
  }
  async function loadVideos() {
    const requestNumber = ++state.requestNumber;
    const params = new URLSearchParams({
      age: age.value, channel: state.channel, q: search.value.trim(), kind: 'video'
    });
    state.hasLoaded = true;
    feedStatus.textContent = 'Loading videos…';
    feed.replaceChildren();
    try {
      const response = await fetch('/api/videos?' + params.toString(), { cache: 'default' });
      if (!response.ok) throw new Error('Videos unavailable right now');
      const payload = await response.json();
      if (requestNumber !== state.requestNumber) return;
      const videos = Array.isArray(payload.videos) ? payload.videos.filter(validVideo) : [];
      state.videos = videos;
      const fragment = document.createDocumentFragment();
      videos.forEach(v => fragment.appendChild(videoCard(v)));
      feed.replaceChildren(fragment);
      if (videos.length === 0) {
        feedStatus.textContent = payload.notice || 'No videos match this age or channel. Try another selection.';
      } else feedStatus.textContent = payload.mode === 'youtube-live' ? '' : 'Starter videos only. Live Tamil-channel videos require a working YouTube API key.';
    } catch (e) {
      if (requestNumber !== state.requestNumber) return;
      feedStatus.textContent = 'Could not load videos. Check your connection and try again.';
      const retry = document.createElement('button'); retry.className = 'text-button';
      retry.type = 'button'; retry.textContent = 'Retry'; retry.onclick = loadVideos;
      feedStatus.append(document.createTextNode(' '), retry);
    }
  }
  channelButtons.forEach(button => button.onclick = () => {
    state.channel = button.dataset.channel;
    channelButtons.forEach(other => {
      const selected = other === button;
      other.classList.toggle('selected', selected);
      other.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    loadVideos();
  });
  search.addEventListener('input', () => {
    clearTimeout(state.timer);
    state.timer = setTimeout(loadVideos, 180);
  });
  age.addEventListener('change', loadVideos);

  function showVideo(video, fromShorts = false) {
    // IDs must come from the server-owned fixed allowlist, never from a URL parameter.
    if (!validVideo(video) || ![...state.videos,...state.shorts].some(v => v.id === video.id)) return;
    showActivity(fromShorts ? 'Shorts' : 'Now Playing', node => {
      const player = document.createElement('div'); player.className = fromShorts ? 'video-player short' : 'video-player';
      const frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + video.id + '?rel=0&playsinline=1';
      frame.title = video.title + ' on YouTube';
      frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.loading = 'eager'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      player.appendChild(frame);
      const heading = document.createElement('h2'); heading.className = 'player-title'; heading.textContent = video.title;
      const channel = document.createElement('p'); channel.className = 'player-channel'; channel.textContent = video.channel + ' · YouTube';
      const linkRow = document.createElement('div'); linkRow.className = 'player-links';
      const link = document.createElement('a'); link.className = 'youtube-link';
      link.href = fromShorts ? 'https://www.youtube.com/shorts/' + video.id : 'https://www.youtube.com/watch?v=' + video.id;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Open on YouTube ↗';
      linkRow.append(link);
      const note = document.createElement('p'); note.className = 'player-note';
      note.textContent = 'YouTube controls playback and may show ads or related videos. Tap Back to stop this video.';
      node.append(player, heading, channel, linkRow, note);
    }, fromShorts ? 'shorts' : 'home', fromShorts ? showShorts : showHome);
  }

  function shortSlides(node, title, scenes) {
    let current = 0;
    function draw() {
      node.replaceChildren();
      const slide = document.createElement('div'); slide.className = 'mini-slide';
      const art = document.createElement('span'); art.className = 'mini-emoji'; art.textContent = scenes[current][0];
      const text = document.createElement('div'); text.className = 'mini-caption'; text.textContent = scenes[current][1];
      const progress = document.createElement('p'); progress.className = 'mini-progress'; progress.textContent = (current + 1) + ' / ' + scenes.length;
      const next = document.createElement('button'); next.className = 'primary-button'; next.type = 'button';
      next.textContent = current === scenes.length - 1 ? 'Watch again' : 'Next →';
      next.onclick = () => {current = (current + 1) % scenes.length; draw();};
      slide.append(art, text, progress, next); node.appendChild(slide);
    }
    draw();
  }
  const offline = [
    { title:'Rhymes', className:'rhymes', image:'rhymes.svg', action: node => window.KidLiteOffline.lullaby(node) },
    { title:'Stories', className:'stories', image:'stories.svg', action: node => window.KidLiteOffline.story(node) },
    { title:'Science', className:'science', image:'science.svg', action: node => shortSlides(node, 'Science', [['🌱','Plants need water and sunlight.'],['🌧️','Rain helps little seeds grow.'],['🌻','Flowers grow toward the light!']]) },
    { title:'Mini Shorts', className:'shorts', image:'shorts.svg', action: node => shortSlides(node, 'Mini Shorts', [['🐢','Tilly found a bright leaf.'],['🐞','She shared it with a tiny bug.'],['🌈','They watched a rainbow together!']]) },
    { title:'Brain Games', className:'games', image:'games.svg', action: node => window.KidLiteOffline.memory(node) },
    { title:'Offline Play', className:'play', image:'offline.svg', action: node => shortSlides(node, 'Offline Play', [['🎨','Try a color game.'],['📖','Read a picture story.'],['🎵','Listen to a gentle lullaby.']]) }
  ];
  function showOffline() {
    showActivity('Offline Play', node => {
      const info = document.createElement('div'); info.className = 'offline-intro';
      const icon = document.createElement('span'); icon.textContent = '✈ Offline activities';
      const status = document.createElement('strong'); status.textContent = 'No data needed';
      info.append(icon, status); node.appendChild(info);
      const grid = document.createElement('div'); grid.className = 'offline-categories';
      offline.forEach(item => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'offline-card ' + item.className;
        const title = document.createElement('strong'); title.textContent = item.title;
        const image = document.createElement('img'); image.src = '/art/' + item.image; image.alt = ''; image.loading = 'lazy';
        button.append(title, image);
        button.onclick = () => showActivity(item.title, item.action, 'offline', showOffline);
        grid.appendChild(button);
      });
      node.appendChild(grid);
    }, 'offline', showHome);
  }

  function showShorts() {
    showActivity('Shorts', node => {
      const note = document.createElement('p');
      note.className = 'short-note';
      note.textContent = 'Tagged #shorts videos from your selected YouTube channels. YouTube controls playback.';
      const grid = document.createElement('div'); grid.className = 'short-feed';
      const status = document.createElement('p'); status.className = 'feed-status';
      status.textContent = 'Fetching Shorts…';
      node.append(note, grid, status);
      const params = new URLSearchParams({kind:'short',age:age.value,channel:'all'});
      fetch('/api/videos?' + params.toString()).then(async response => {
        if (!response.ok) throw new Error('Shorts API unavailable');
        return response.json();
      }).then(data => {
        const videos = Array.isArray(data.videos) ? data.videos.filter(validVideo) : [];
        state.shorts = videos;
        grid.replaceChildren();
        videos.forEach(video => {
          const card = document.createElement('article'); card.className = 'short-card';
          const cover = document.createElement('button'); cover.className = 'short-preview'; cover.type = 'button';
          cover.setAttribute('aria-label', 'Play ' + video.title);
          const img = document.createElement('img'); img.loading = 'lazy'; img.alt = '';
          img.src = video.thumbnail || ('https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg');
          const play = document.createElement('span'); play.className = 'video-play';
          play.setAttribute('aria-hidden', 'true');
          play.innerHTML = '<svg viewBox="0 0 24 24"><path fill="#fff" d="m7 3 14 9-14 9z"/></svg>';
          cover.append(img,play); cover.onclick = () => showVideo(video,true);
          const detail = document.createElement('div');
          const title = document.createElement('p'); title.className = 'short-title'; title.textContent = video.title;
          const by = document.createElement('p'); by.className = 'short-channel'; by.textContent = video.channel + ' · YouTube';
          const button = document.createElement('button'); button.type = 'button'; button.className = 'short-watch';
          button.textContent = 'Watch Short'; button.onclick = () => showVideo(video,true);
          detail.append(title,by,button); card.append(cover,detail); grid.append(card);
        });
        status.textContent = videos.length ? '' : (data.notice || 'No tagged YouTube Shorts available from selected channels yet.');
      }).catch(() => {status.textContent = 'Could not load YouTube Shorts. Check API key or network.';});
    },'shorts',showHome);
  }

  function showSettings() {
    showActivity('Settings', node => {
      const root = document.createElement('div'); root.className = 'settings-list';
      const section = label => {
        const name = document.createElement('p'); name.className = 'settings-section-label'; name.textContent = label; root.appendChild(name);
        const container = document.createElement('div'); container.className = 'settings-card'; root.appendChild(container);
        return container;
      };
      const item = (parent, icon, title, note, onClick, disabled = false) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'settings-row'; button.disabled = disabled;
        const emoji = document.createElement('span'); emoji.className = 'settings-row-icon'; emoji.textContent = icon;
        const text = document.createElement('span'); text.className = 'settings-row-text';
        const label = document.createElement('strong'); label.textContent = title;
        const hint = document.createElement('small'); hint.textContent = note;
        text.append(label, hint);
        const arrow = document.createElement('span'); arrow.className = 'settings-row-end'; arrow.textContent = disabled ? 'Soon' : '›';
        button.append(emoji, text, arrow);
        if (onClick) button.onclick = onClick;
        parent.appendChild(button);
        return button;
      };
      const general = section('General');
      item(general,'👤','My profile','Account and sign out',() => {
        const clerk = window.KidLiteAuth?.clerk;
        if (typeof clerk?.openUserProfile === 'function') clerk.openUserProfile();
        else document.getElementById('clerk-user-button')?.querySelector('button')?.click();
      });
      item(general,'📚','Offline Play','Stories, mini shorts and games',showOffline);
      item(general,'↓','Install KidLite','Save to home screen',() => document.getElementById('install-btn').click());
      const channelSection = section('Your selected channels');
      item(channelSection,'🍉','CoComelon','Parent selected',null,true);
      item(channelSection,'🚂','Kids Channel','Parent selected',null,true);
      const preferences = section('Preferences');
      const motion = item(preferences,'✨','Reduce motion','Simpler animations',null);
      const label = document.createElement('label'); label.className = 'settings-row';
      label.append(...Array.from(motion.children).slice(0,2)); motion.replaceWith(label);
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.className = 'settings-switch';
      toggle.setAttribute('aria-label','Reduce motion');
      try { toggle.checked = localStorage.getItem('kidlite.reduceMotion') === '1'; } catch (_) {}
      document.documentElement.classList.toggle('reduce-motion', toggle.checked);
      toggle.onchange = () => {
        document.documentElement.classList.toggle('reduce-motion',toggle.checked);
        try {localStorage.setItem('kidlite.reduceMotion', toggle.checked ? '1':'0');} catch (_) {}
      };
      label.append(toggle);
      const parent = section('Parent');
      item(parent,'🔐','Parent Controls','PIN and screen-time settings',null,true);
      const foot = document.createElement('p'); foot.className = 'settings-footer';
      foot.textContent = 'KidLite · Early access · YouTube-sourced video feed';
      root.append(foot); node.append(root);
    }, 'settings', showHome);
  }

  navButtons.forEach(button => button.onclick = () => {
    if (button.dataset.view === 'home') showHome();
    else if (button.dataset.view === 'shorts') showShorts();
    else if (button.dataset.view === 'offline') showOffline();
    else showSettings();
  });

  // Search is opened on demand from the top bar.
  const searchToggle = document.getElementById('search-toggle');
  const searchPanel = document.getElementById('header-search');
  const searchClose = document.getElementById('search-close');
  const notifyToggle = document.getElementById('notification-toggle');
  const notifyPanel = document.getElementById('notifications-panel');
  function setSearch(open) {
    searchPanel.hidden = !open;
    searchToggle.setAttribute('aria-expanded',String(open));
    if(open) {
      notifyPanel.hidden = true;
      notifyToggle.setAttribute('aria-expanded','false');
      search.focus();
    }
  }
  searchToggle.onclick = () => setSearch(searchPanel.hidden);
  searchClose.onclick = () => setSearch(false);
  notifyToggle.onclick = () => {
    const isOpen=notifyPanel.hidden;
    notifyPanel.hidden = !isOpen;
    notifyToggle.setAttribute('aria-expanded',String(isOpen));
    if(isOpen) setSearch(false);
  };
  document.addEventListener('keydown', event => {
    if(event.key==='Escape') {
      setSearch(false);
      notifyPanel.hidden=true;
      notifyToggle.setAttribute('aria-expanded','false');
    }
  });
  // The green indicator means the original offline activity files were cached;
  // it does NOT imply YouTube works without data.
  async function updateOfflineReady() {
    const indicator=document.getElementById('offline-ready-indicator');
    if(!indicator || !('caches' in window)) return;
    try {
      const cache=await caches.open('kidlite-offline-v6');
      const required=['/index.html','/offline-games.js','/app.js','/styles.css','/art/offline.svg'];
      const matches=await Promise.all(required.map(path=>cache.match(path)));
      const ready=matches.every(Boolean);
      indicator.classList.toggle('hidden',!ready);
      indicator.hidden=!ready;
    } catch (_) {
      indicator.hidden=true;
      indicator.classList.add('hidden');
    }
  }
  updateOfflineReady();
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(updateOfflineReady).catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',updateOfflineReady);
  }

  window.KidLiteApp = { showHome, showOffline, showSettings };
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  let prompt;
  window.addEventListener('beforeinstallprompt', event => {event.preventDefault(); prompt = event;});
  function onIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;}
  document.getElementById('install-btn').onclick = () => {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return;
    if (prompt) {prompt.prompt(); prompt = null; return;}
    document.getElementById('install-instructions').textContent = onIOS()
      ? 'In Safari, tap Share, then Add to Home Screen.'
      : 'In your browser menu, choose Install app or Add to Home Screen.';
    document.getElementById('install-dialog').showModal();
  };
})();
