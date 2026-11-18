(function () {
  'use strict';
  const home = document.getElementById('main-view');
  const activity = document.getElementById('activity-view');
  const authScreen = document.getElementById('auth-screen');
  const dock = document.querySelector('.dock');
  const feed = document.getElementById('video-feed');
  const feedStatus = document.getElementById('feed-status');
  const search = document.getElementById('video-query');
  const channelButtons = [...document.querySelectorAll('[data-channel]')];
  const navButtons = [...document.querySelectorAll('.dock-button')];
  const state = { channel: 'tamil', requestNumber: 0, videos: [], shorts: [], timer: null, hasLoaded: false };

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
    const tamilChannel = ['chuchutamil','pattampoochi','infobellstamil','shemarootamil','chuttykannamma','kidstvtamil'].includes(video.channelKey);
    const published = Date.parse(video.publishedAt || '');
    if (tamilChannel && Number.isFinite(published) && Date.now() >= published && Date.now() - published < 14*24*60*60*1000) {
      const badge = document.createElement('span');
      badge.className = 'fresh-video-badge';
      badge.textContent = 'NEW';
      thumbnail.appendChild(badge);
    }
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
      age: 'all', channel: state.channel, q: search.value.trim(), kind: 'video'
    });
    state.hasLoaded = true;
    if (state.channel === 'originals') {
      // Original video releases are not available yet; never label third-party YouTube content as ours.
      state.videos = [];
      feed.replaceChildren();
      feedStatus.textContent = 'KidLite Originals videos are coming soon.';
      return;
    }
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

  function showVideo(video) {
    // Only recommend metadata returned by the server's allowlisted channel feed.
    if (!validVideo(video) || !state.videos.some(item => item.id === video.id)) return;
    const suggestions = state.videos
      .filter(item => validVideo(item) && item.id !== video.id)
      .sort((a, b) => Number(b.channelKey === video.channelKey) - Number(a.channelKey === video.channelKey))
      .slice(0, 4);

    showActivity('Now Playing', node => {
      const player = document.createElement('div');
      player.className = 'video-player';
      const frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + video.id + '?rel=0&playsinline=1&autoplay=1';
      frame.title = video.title + ' on YouTube';
      frame.allow = 'autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.loading = 'eager';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      player.appendChild(frame);

      const heading = document.createElement('h2');
      heading.className = 'player-title';
      heading.textContent = video.title;
      const metadata = document.createElement('div');
      metadata.className = 'player-meta';
      const channel = document.createElement('p');
      channel.className = 'player-channel';
      channel.textContent = video.channel + ' · YouTube';
      const youtubeLink = document.createElement('a');
      youtubeLink.className = 'youtube-icon-link';
      youtubeLink.href = 'https://www.youtube.com/watch?v=' + video.id;
      youtubeLink.target = '_blank';
      youtubeLink.rel = 'noopener noreferrer';
      youtubeLink.title = 'Open on YouTube';
      youtubeLink.setAttribute('aria-label', 'Open on YouTube');
      youtubeLink.innerHTML = '<svg viewBox="0 0 24 18" aria-hidden="true"><rect x="1" y="1" width="22" height="16" rx="5" fill="#f03c40"/><path d="m10 5 7 4-7 4z" fill="white"/></svg>';
      metadata.append(channel, youtubeLink);
      node.append(player, heading, metadata);

      if (suggestions.length) {
        const section = document.createElement('section');
        section.className = 'video-suggestions';
        section.setAttribute('aria-label', 'Four suggested videos');
        const title = document.createElement('h3');
        title.textContent = 'Up next';
        section.appendChild(title);
        const list = document.createElement('div');
        list.className = 'suggestion-list';
        for (const suggested of suggestions) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'suggestion-card';
          button.setAttribute('aria-label', 'Play ' + suggested.title);
          const thumb = document.createElement('img');
          thumb.src = suggested.thumbnail || ('https://i.ytimg.com/vi/' + suggested.id + '/hqdefault.jpg');
          thumb.alt = '';
          thumb.loading = 'lazy';
          thumb.decoding = 'async';
          const details = document.createElement('span');
          details.className = 'suggestion-details';
          const suggestedTitle = document.createElement('strong');
          suggestedTitle.textContent = suggested.title;
          const suggestedChannel = document.createElement('small');
          suggestedChannel.textContent = suggested.channel;
          details.append(suggestedTitle, suggestedChannel);
          button.append(thumb, details);
          button.onclick = () => showVideo(suggested);
          list.appendChild(button);
        }
        section.appendChild(list);
        node.appendChild(section);
      }
    }, 'home', showHome);
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
    // Fullscreen player opens immediately, with one embed and no list of watch buttons.
    window.KidLiteShorts.open({ age: 'all', onExit: showHome });
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
      const cache=await caches.open('kidlite-offline-v8');
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
