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
  const state = {
    channel:'all',requestNumber:0,videos:[],timer:null,hasLoaded:false,
    feedCursor:0,feedObserver:null,sentinel:null,fetchController:null,
    feedCache:new Map(), returnScrollY:0
  };
  const FEED_CHUNK = 7;
  const freshness = window.KidLiteFreshness;
  const refreshButton = document.getElementById('feed-refresh');
  state.feedSeed = freshness?.createSeed() || Date.now();
  state.lastRefreshAt = 0;
  function shuffledVideos(videos) {
    return freshness ? freshness.order(videos,{seed:state.feedSeed,channel:state.channel}) : videos;
  }
  let activeVideoSession = null;

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
    // Stop the previous player and remove its fullscreen/orientation listeners before navigation.
    if (activeVideoSession) {
      const previous = activeVideoSession;
      activeVideoSession = null;
      previous.dispose();
    }
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
    if (activeVideoSession) {
      const previous = activeVideoSession;
      activeVideoSession = null;
      previous.dispose();
    }
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
    const openVideo = () => {
      state.returnScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      showVideo(video);
    };
    const thumbnail = document.createElement('button');
    thumbnail.type = 'button'; thumbnail.className = 'video-thumbnail';
    thumbnail.setAttribute('aria-label', 'Play ' + video.title);
    const image = document.createElement('img');
    image.src = video.thumbnail || ('https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg');
    image.alt = '';
    image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    image.fetchPriority = state.feedCursor < FEED_CHUNK ? 'auto' : 'low';
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
    avatar.textContent = ({cocomelon:'🍉',kidschannel:'🚂',chuchutamil:'🎵',pattampoochi:'🦋',infobellstamil:'🌸',shemarootamil:'📚',chuttykannamma:'🌈',kidstvtamil:'🐥',bumblezoop:'🚜',bachpankiduniya:'🎶',bibotoys:'🚗'})[video.channelKey] || '🎬';
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
      ['cocomelon','kidschannel','chuchutamil','pattampoochi','infobellstamil','shemarootamil','chuttykannamma','kidstvtamil','bumblezoop','bachpankiduniya','bibotoys'].includes(v.channelKey) &&
      typeof v.title === 'string' && typeof v.channel === 'string';
  }
  function disconnectFeedObserver() {
    state.feedObserver?.disconnect();
    state.feedObserver = null;
    state.sentinel?.remove();
    state.sentinel = null;
  }

  function appendFeedChunk() {
    if (!state.videos.length) return;
    state.sentinel?.remove();
    const end = Math.min(state.feedCursor + FEED_CHUNK, state.videos.length);
    const chunk = document.createDocumentFragment();
    for (let i = state.feedCursor; i < end; i++) {
      chunk.appendChild(videoCard(state.videos[i]));
    }
    state.feedCursor = end;
    feed.appendChild(chunk);
    if (state.feedCursor < state.videos.length && state.sentinel) {
      feed.append(state.sentinel);
      if (state.feedObserver) state.feedObserver.observe(state.sentinel);
    } else {
      disconnectFeedObserver();
    }
  }

  function displayVideos(videos, notice) {
    disconnectFeedObserver();
    state.videos = videos;
    state.feedCursor = 0;
    feed.replaceChildren();
    feedStatus.textContent = videos.length ? (notice || '') : (notice || 'No videos match these channels.');
    if (!videos.length) return;

    // One near-viewport sentinel. The DOM grows only as the parent scrolls down.
    const sentinel = document.createElement('button');
    sentinel.className = 'feed-more-sentinel';
    sentinel.type = 'button';
    sentinel.textContent = 'Load more videos';
    sentinel.onclick = appendFeedChunk;
    state.sentinel = sentinel;

    if ('IntersectionObserver' in window) {
      state.feedObserver = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        state.feedObserver?.unobserve(sentinel);
        appendFeedChunk();
      },{rootMargin:'650px 0px',threshold:0});
    }
    appendFeedChunk();
  }

  async function loadVideos(options={}) {
    const requestNumber = ++state.requestNumber;
    state.fetchController?.abort();
    state.fetchController = new AbortController();
    const params = new URLSearchParams({
      age:'all',channel:state.channel,q:search.value.trim(),kind:'video'
    });
    const cacheKey = params.toString();
    state.hasLoaded = true;
    if (state.channel === 'originals') {
      displayVideos([], 'KidLite Originals videos are coming soon.');
      return;
    }
    const old = state.feedCache.get(cacheKey);
    if (!options.force && old && Date.now() < old.until) {
      displayVideos(shuffledVideos(old.videos),old.notice);
      return;
    }
    feedStatus.textContent = 'Loading videos…';
    disconnectFeedObserver();
    feed.replaceChildren();
    try {
      const response = await fetch('/api/videos?' + cacheKey,{
        cache:'default',signal:state.fetchController.signal
      });
      if (!response.ok) throw new Error('Video API unavailable');
      const payload = await response.json();
      if (requestNumber !== state.requestNumber) return;
      const videos = Array.isArray(payload.videos) ? payload.videos.filter(validVideo) : [];
      const notice = videos.length
        ? (payload.mode === 'youtube-live' ? '' : 'Starter videos only; live YouTube API unavailable.')
        : (payload.notice || 'No videos match these filters.');
      if (state.feedCache.size >= 10) state.feedCache.delete(state.feedCache.keys().next().value);
      state.feedCache.set(cacheKey,{videos,notice,until:Date.now()+3*60*1000});
      displayVideos(shuffledVideos(videos),notice);
    } catch (error) {
      if (requestNumber !== state.requestNumber || error?.name === 'AbortError') return;
      // Show text-only cached titles without presenting them as playable offline videos.
      if (window.KidLiteCatalogue) {
        const cached=await window.KidLiteCatalogue.getItems({kind:'video',channel:state.channel,q:search.value});
        if (requestNumber !== state.requestNumber) return;
        disconnectFeedObserver();feed.replaceChildren();
        if(cached.length){
          const notice=document.createElement('p');notice.className='offline-catalog-note';
          notice.textContent='Offline titles only · YouTube playback requires internet';
          feed.append(notice);
          for(const item of cached.slice(0,25)){
            const row=document.createElement('div');row.className='offline-catalog-row';
            const title=document.createElement('strong');title.textContent=item.title;
            const by=document.createElement('small');by.textContent=item.channel+' · Internet required';
            row.append(title,by);feed.append(row);
          }
          feedStatus.textContent='Last synced catalogue. Open Offline Play for games without internet.';
          return;
        }
      }
      feedStatus.textContent = 'Could not load videos. Check the connection and retry.';
      const retry = document.createElement('button');
      retry.type = 'button';retry.className = 'text-button';retry.textContent = 'Retry';
      retry.onclick = loadVideos;
      feedStatus.append(document.createTextNode(' '),retry);
    }
  }
  function refreshFeed() {
    if (!signedIn() || home.classList.contains('hidden')) return;
    const now=Date.now();
    if (now-state.lastRefreshAt<800) return;
    state.lastRefreshAt=now;
    // New shuffle seed is local, not an API query parameter, preserving CDN/quota.
    state.feedSeed=freshness?.createSeed() || now;
    if(refreshButton)refreshButton.classList.add('refreshing');
    window.scrollTo({top:0,behavior:'instant'});
    loadVideos({force:true}).finally(()=>{
      refreshButton?.classList.remove('refreshing');
    });
  }
  if(refreshButton)refreshButton.onclick=refreshFeed;
  // Native pull gestures are observed passively; no interception of scrolling.
  let feedPullStart=null;
  home.addEventListener('touchstart',event=>{
    if(home.classList.contains('hidden')||window.scrollY>5||event.touches.length!==1)return;
    feedPullStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  home.addEventListener('touchend',event=>{
    if(!feedPullStart||!event.changedTouches.length)return;
    const dy=event.changedTouches[0].clientY-feedPullStart.y;
    const dx=event.changedTouches[0].clientX-feedPullStart.x;
    feedPullStart=null;
    if(dy>95 && Math.abs(dy)>Math.abs(dx)*1.35 && window.scrollY<12) refreshFeed();
  },{passive:true});
  home.addEventListener('touchcancel',()=>{feedPullStart=null;},{passive:true});

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
    if (!validVideo(video) || !state.videos.some(item => item.id === video.id)) return;
    let current = video;
    const candidates = selected => state.videos
      .filter(item => validVideo(item) && item.id !== selected.id)
      .sort((a,b) => Number(b.channelKey===selected.channelKey)-Number(a.channelKey===selected.channelKey))
      .slice(0, 4);
    freshness?.markWatched(video.id);

    showActivity('Watch video', node => {
      const shell = document.createElement('div');
      shell.className = 'player-shell';

      const toolbar = document.createElement('div');
      toolbar.className = 'player-fullscreen-toolbar';
      const exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'player-exit-fullscreen';
      exit.textContent = '← Exit';
      exit.setAttribute('aria-label','Exit fullscreen');
      const fullLabel = document.createElement('span');
      fullLabel.className = 'player-fullscreen-label';
      fullLabel.textContent = 'YouTube';
      const upNext = document.createElement('button');
      upNext.type = 'button';
      upNext.className = 'player-fullscreen-next-toggle';
      upNext.textContent = 'Up next (4)';
      upNext.setAttribute('aria-label','Show up to four suggested videos');
      upNext.setAttribute('aria-expanded','false');
      toolbar.append(exit,fullLabel,upNext);

      const frameHolder = document.createElement('div');
      frameHolder.className = 'video-player';
      const frame = document.createElement('iframe');
      const videoUrl = selected => 'https://www.youtube-nocookie.com/embed/' + selected.id +
        '?rel=0&playsinline=1&autoplay=1';
      frame.src = videoUrl(current);
      frame.title = current.title + ' on YouTube';
      frame.allow = 'autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.loading = 'eager';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frameHolder.append(frame);

      const expandedSuggestions = document.createElement('section');
      expandedSuggestions.className = 'player-fullscreen-recommendations';
      expandedSuggestions.hidden = true;
      expandedSuggestions.setAttribute('aria-label','Up to four approved video suggestions');
      const fullscreenList = document.createElement('div');
      fullscreenList.className = 'player-fullscreen-recommendation-list';
      expandedSuggestions.append(fullscreenList);
      shell.append(toolbar,frameHolder,expandedSuggestions);

      const metadata = document.createElement('div');
      metadata.className = 'player-meta';
      const channel = document.createElement('p');
      channel.className = 'player-channel';
      const actions = document.createElement('div');
      actions.className = 'player-actions';
      const youtubeLink = document.createElement('a');
      youtubeLink.className = 'youtube-icon-link';
      youtubeLink.target = '_blank';
      youtubeLink.rel = 'noopener noreferrer';
      youtubeLink.title = 'Open on YouTube';
      youtubeLink.setAttribute('aria-label','Open on YouTube');
      youtubeLink.innerHTML = '<svg viewBox="0 0 24 18" aria-hidden="true"><rect x="1" y="1" width="22" height="16" rx="5" fill="#f03c40"/><path d="m10 5 7 4-7 4z" fill="white"/></svg>';
      const expand = document.createElement('button');
      expand.className = 'player-expand';
      expand.type = 'button';
      expand.setAttribute('aria-label','Fullscreen landscape video');
      expand.title = 'Fullscreen landscape';
      expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Expand</span>';
      actions.append(youtubeLink,expand);
      metadata.append(channel,actions);
      const status = document.createElement('p');
      status.className = 'player-orientation-status';
      status.setAttribute('role','status');

      const suggestionsSection = document.createElement('section');
      suggestionsSection.className = 'video-suggestions';
      suggestionsSection.setAttribute('aria-label','Up to four suggested videos');
      const suggestionsTitle = document.createElement('h3');
      suggestionsTitle.textContent = 'Up next';
      const suggestionsList = document.createElement('div');
      suggestionsList.className = 'suggestion-list';
      suggestionsSection.append(suggestionsTitle,suggestionsList);
      node.append(shell,metadata,status,suggestionsSection);

      let disposed = false;
      let orientationLocked = false;
      let enteredFullscreen = false;

      const closeExpandedList = () => {
        expandedSuggestions.hidden = true;
        upNext.setAttribute('aria-expanded','false');
        upNext.textContent = 'Up next (4)';
      };
      const createSuggestion = (suggested,compact) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = compact ? 'player-fullscreen-suggestion' : 'suggestion-card';
        button.setAttribute('aria-label','Play ' + suggested.title);
        const thumbnail = document.createElement('img');
        thumbnail.src = suggested.thumbnail ||
          ('https://i.ytimg.com/vi/'+suggested.id+'/hqdefault.jpg');
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.decoding = 'async';
        const details = document.createElement('span');
        details.className = 'suggestion-details';
        const name = document.createElement('strong');
        name.textContent = suggested.title;
        const by = document.createElement('small');
        by.textContent = suggested.channel;
        details.append(name,by);
        button.append(thumbnail,details);
        button.onclick = () => changeVideo(suggested);
        return button;
      };
      const renderSuggestions = () => {
        const results = candidates(current);
        suggestionsList.replaceChildren(...results.map(item => createSuggestion(item,false)));
        fullscreenList.replaceChildren(...results.map(item => createSuggestion(item,true)));
        upNext.textContent = 'Up next ('+results.length+')';
        upNext.disabled = results.length===0;
        suggestionsSection.hidden = results.length===0;
        if(!results.length)closeExpandedList();
      };
      const changeVideo = selected => {
        if(disposed || !validVideo(selected) || !state.videos.some(item=>item.id===selected.id))return;
        current = selected;
        freshness?.markWatched(current.id);
        // The iframe changes source only when the parent explicitly chooses another
        // allowlisted video. Fullscreen shell and orientation remain unchanged.
        frame.src = videoUrl(current);
        frame.title = current.title + ' on YouTube';
        channel.textContent = current.channel + ' · YouTube';
        youtubeLink.href = 'https://www.youtube.com/watch?v=' + current.id;
        closeExpandedList();
        renderSuggestions();
        if(document.fullscreenElement !== shell)node.scrollIntoView({block:'start',behavior:'instant'});
      };
      channel.textContent = current.channel + ' · YouTube';
      youtubeLink.href = 'https://www.youtube.com/watch?v=' + current.id;
      renderSuggestions();
      upNext.onclick = () => {
        const showing = !expandedSuggestions.hidden;
        expandedSuggestions.hidden = showing;
        upNext.setAttribute('aria-expanded',String(!showing));
        upNext.textContent = showing ? 'Up next ('+candidates(current).length+')' : 'Hide suggestions';
      };

      const unlockOrientation = () => {
        if (!orientationLocked) return;
        orientationLocked = false;
        try { window.screen.orientation?.unlock?.(); } catch (_) {}
      };
      const onFullscreenChange = () => {
        const inFullscreen = document.fullscreenElement === shell;
        if (enteredFullscreen && !inFullscreen) {
          enteredFullscreen = false;
          closeExpandedList();
          unlockOrientation();
          status.textContent = '';
          fullLabel.textContent = 'YouTube';
        }
      };
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        document.removeEventListener('fullscreenchange',onFullscreenChange);
        unlockOrientation();
        if (document.fullscreenElement === shell && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      };
      document.addEventListener('fullscreenchange',onFullscreenChange);
      activeVideoSession = {dispose};

      exit.onclick = () => {
        if (document.fullscreenElement === shell && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else unlockOrientation();
      };
      expand.onclick = async () => {
        if (disposed) return;
        status.textContent = '';
        if (document.fullscreenElement === shell) {
          exit.click();
          return;
        }
        if (!shell.requestFullscreen) {
          status.textContent = 'Fullscreen not supported here. Try the YouTube fullscreen button.';
          return;
        }
        try {
          await shell.requestFullscreen({navigationUI:'hide'});
          if (disposed || document.fullscreenElement !== shell) return;
          enteredFullscreen = true;
          if (typeof window.screen.orientation?.lock === 'function') {
            try {
              await window.screen.orientation.lock('landscape');
              if (disposed || document.fullscreenElement !== shell) {
                try {window.screen.orientation.unlock?.();}catch(_){}
                return;
              }
              orientationLocked = true;
              fullLabel.textContent = 'Landscape · YouTube';
            } catch (_) {
              fullLabel.textContent = 'Rotate phone · YouTube';
              status.textContent = 'Fullscreen is active. Rotate your phone if landscape is unavailable.';
            }
          } else {
            fullLabel.textContent = 'Rotate phone · YouTube';
            status.textContent = 'Fullscreen is active. Rotate your phone if necessary.';
          }
        } catch (_) {
          status.textContent = 'Browser blocked fullscreen. Use the YouTube fullscreen control.';
        }
      };
    }, 'home', () => {
      showHome();
      requestAnimationFrame(() => window.scrollTo({top:state.returnScrollY,behavior:'instant'}));
    });
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
  // Cached YouTube metadata is browseable offline; official YouTube playback still needs internet.
  async function showSavedCatalogue() {
    showActivity('Saved video titles', node => {
      const info = document.createElement('div');
      info.className = 'offline-catalog-note';
      info.textContent = 'Video titles can be browsed offline. YouTube videos themselves need internet. Only original games and stories play offline.';
      const status = document.createElement('p'); status.className = 'offline-catalog-status';
      status.textContent = 'Reading saved titles…';
      const actions = document.createElement('div'); actions.className = 'offline-catalog-actions';
      const refresh = document.createElement('button'); refresh.className = 'text-button'; refresh.type = 'button';
      refresh.textContent = 'Sync latest titles';
      const clear = document.createElement('button'); clear.className = 'text-button'; clear.type = 'button';
      clear.textContent = 'Clear saved titles';
      actions.append(refresh,clear);
      const list = document.createElement('div'); list.className = 'offline-catalog-list';
      node.append(info,status,actions,list);
      let count=0;
      async function draw() {
        const catalog = window.KidLiteCatalogue;
        if (!catalog) {status.textContent = 'Offline storage is unavailable.'; return;}
        const [meta,items] = await Promise.all([catalog.getStatus(),catalog.getItems({channel:'all'})]);
        count=items.length;
        status.textContent = count
          ? count+' saved titles · '+(meta.shorts||0)+' Shorts · Last synced '+new Date(meta.updatedAt).toLocaleDateString()
          : 'No video titles saved yet. Connect to the internet to sync them.';
        list.replaceChildren();
        // Show only 25 initially to avoid creating large DOMs offline.
        const initial=items.slice(0,25);
        const makeRow = item => {
          const row=document.createElement('div');row.className='offline-catalog-row';
          const name=document.createElement('strong');name.textContent=item.title;
          const subtitle=document.createElement('small');subtitle.textContent=item.channel+' · '+(item.kind==='short'?'Short':'Video')+' · Online playback only';
          row.append(name,subtitle);return row;
        };
        initial.forEach(item=>list.appendChild(makeRow(item)));
        if(items.length>25) {
          const more=document.createElement('button');more.type='button';more.className='text-button';
          more.textContent='Show '+(items.length-25)+' more titles';
          let index=25;
          more.onclick=()=>{
            const fragment=document.createDocumentFragment();
            for(const item of items.slice(index,index+25))fragment.appendChild(makeRow(item));
            list.insertBefore(fragment,more);
            index=Math.min(index+25,items.length);
            more.textContent='Show '+(items.length-index)+' more titles';
            if(index>=items.length)more.remove();
          };
          list.append(more);
        }
      }
      refresh.onclick=async()=>{
        if(navigator.onLine===false){status.textContent='Connect to the internet to refresh.';return;}
        refresh.disabled=true;status.textContent='Checking the latest video titles…';
        try {
          const result=await window.KidLiteCatalogue.synchronize(true);
          if(!result.ok) status.textContent='Could not complete refresh; previous saved titles are kept.';
          else await draw();
        } finally {refresh.disabled=false;}
      };
      clear.onclick=async()=>{
        if(!window.confirm('Delete the locally saved video titles? Original offline games are not affected.'))return;
        try {await window.KidLiteCatalogue.clear();await draw();}
        catch (_) {status.textContent='Could not clear saved titles.';}
      };
      draw().catch(()=>{status.textContent='Offline catalogue is not supported on this device.';});
    },'offline',showOffline);
  }

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
      const saved = document.createElement('button');
      saved.type='button';saved.className='offline-catalogue-trigger';
      saved.innerHTML='<span aria-hidden="true">📋</span><span><strong>Saved video titles</strong><small>Browse the last synced list without data · YouTube playback needs internet</small></span><span aria-hidden="true">›</span>';
      saved.onclick=showSavedCatalogue;
      node.appendChild(saved);
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
      item(general,'📋','Saved video titles','Lightweight offline catalogue',showSavedCatalogue);
      if (!window.KidLiteInstall?.installed) {
        item(general,'📲','Install KidLite','Add to Home Screen',() => window.KidLiteInstall?.open());
      }
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
      const cache=await caches.open('kidlite-offline-v16');
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
})();
