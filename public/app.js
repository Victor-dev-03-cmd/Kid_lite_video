(function () {
  'use strict';

  const home = document.getElementById('main-view');
  const activity = document.getElementById('activity-view');
  const authScreen = document.getElementById('auth-screen');
  const dock = document.querySelector('.dock');
  const parentButton = document.getElementById('parent-btn');
  const navButtons = [...document.querySelectorAll('.dock-button')];

  function isSignedIn() { return Boolean(window.KidLiteAuth?.signedIn); }

  function setNav(view) {
    for (const btn of navButtons) {
      const active = btn.dataset.view === view;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  }

  function showActivity(title, render, selectedView = 'offline') {
    authScreen.classList.add('hidden');
    home.classList.add('hidden');
    activity.classList.remove('hidden');
    activity.replaceChildren();
    dock.classList.toggle('hidden', !isSignedIn());
    parentButton.classList.toggle('hidden', !isSignedIn());

    const header = document.createElement('div');
    header.className = 'activity-header';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'back-button';
    back.textContent = '←';
    back.setAttribute('aria-label', 'Back');
    back.onclick = showHome;
    const name = document.createElement('h1');
    name.textContent = title;
    header.append(back, name);
    activity.appendChild(header);
    const content = document.createElement('div');
    content.className = 'activity-content';
    activity.appendChild(content);
    render(content);
    setNav(selectedView);
    window.scrollTo(0, 0);
  }

  function showHome() {
    activity.replaceChildren();
    activity.classList.add('hidden');
    setNav('home');
    if (isSignedIn()) {
      authScreen.classList.add('hidden');
      home.classList.remove('hidden');
      dock.classList.remove('hidden');
      parentButton.classList.remove('hidden');
    } else {
      home.classList.add('hidden');
      authScreen.classList.remove('hidden');
      dock.classList.add('hidden');
      parentButton.classList.add('hidden');
    }
    window.scrollTo(0, 0);
  }

  function showOffline() {
    showActivity('Offline Play', node => {
      const banner = document.createElement('div');
      banner.className = 'offline-banner';
      banner.innerHTML = '<span aria-hidden="true">✈</span><b>Offline mode ready</b><span class="status-dot"></span>';
      node.appendChild(banner);
      const tiles = document.createElement('div');
      tiles.className = 'activity-grid';
      const items = [
        { emoji: '🎧', title: 'Audio Stories', detail: 'Little lullaby', key: 'lullaby', color: 'audio' },
        { emoji: '📖', title: 'Picture Books', detail: 'Tilly’s rainbow', key: 'story', color: 'books' },
        { emoji: '🧠', title: 'Brain Games', detail: 'Color memory', key: 'memory', color: 'brain' }
      ];
      for (const item of items) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'activity-tile ' + item.color;
        card.innerHTML = '<span class="tile-emoji" aria-hidden="true">' + item.emoji + '</span><strong>' + item.title + '</strong><small>' + item.detail + '</small>';
        card.onclick = () => showActivity(item.title, window.KidLiteOffline[item.key]);
        tiles.appendChild(card);
      }
      node.appendChild(tiles);
    }, 'offline');
  }

  function showUnfinished(title, emoji, message, view = 'home') {
    showActivity(title, node => {
      const box = document.createElement('div');
      box.className = 'empty-state';
      const art = document.createElement('span');
      art.className = 'empty-emoji';
      art.textContent = emoji;
      const heading = document.createElement('h2');
      heading.textContent = 'Coming soon';
      const note = document.createElement('p');
      note.textContent = message;
      const button = document.createElement('button');
      button.className = 'primary-button';
      button.type = 'button';
      button.textContent = 'Back';
      button.onclick = showHome;
      box.append(art, heading, note, button);
      node.appendChild(box);
    }, view);
  }

  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.onclick = () => {
      const category = btn.dataset.category;
      if (category === 'Offline') return showOffline();
      if (category === 'Games') return showActivity('Brain Games', window.KidLiteOffline.memory);
      const message = category === 'Shorts' ? 'Parent-approved short videos will appear here.' : 'Parent-approved videos will appear here.';
      showUnfinished(category, category === 'Science' ? '🔬' : category === 'Stories' ? '📚' : category === 'Shorts' ? '🎞️' : '🎵', message, category === 'Shorts' ? 'shorts' : 'home');
    };
  });
  navButtons.forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.view === 'home') showHome();
      else if (btn.dataset.view === 'offline') showOffline();
      else showUnfinished('Shorts', '🎞️', 'Parent-approved short videos will appear here.', 'shorts');
    };
  });
  parentButton.onclick = () => showUnfinished('Parent Controls', '🔐', 'PIN, approved channels and screen-time settings are coming soon.');

  window.KidLiteApp = { showHome, showOffline };

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  let installPrompt;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  const installButton = document.getElementById('install-btn');
  installButton.onclick = () => {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return;
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt = null;
    } else {
      document.getElementById('install-instructions').textContent = isIOS()
        ? 'In Safari, tap Share, then Add to Home Screen.'
        : 'In your browser menu, choose Install app or Add to Home Screen.';
      document.getElementById('install-dialog').showModal();
    }
  };
})();
