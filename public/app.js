(function () {
  'use strict';
  const home = document.getElementById('main-view');
  const activity = document.getElementById('activity-view');
  const navButtons = Array.from(document.querySelectorAll('.dock-button'));
  function setNav(view) {
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  }
  function showActivity(title, render, view = 'offline') {
    home.classList.add('hidden'); activity.classList.remove('hidden'); activity.replaceChildren();
    const header = document.createElement('div'); header.className = 'activity-header';
    const h = document.createElement('h1'); h.textContent = title;
    const back = document.createElement('button'); back.className = 'text-button'; back.textContent = '← Back'; back.onclick = showHome;
    header.append(h, back); activity.appendChild(header);
    const body = document.createElement('div'); activity.appendChild(body); render(body); setNav(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function showHome() {
    activity.classList.add('hidden'); activity.replaceChildren(); home.classList.remove('hidden'); setNav('home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function showOffline() {
    showActivity('Offline play space', node => {
      const grid = document.createElement('div'); grid.className = 'activity-grid';
      [['📖', 'Tilly’s rainbow', 'An interactive picture story', 'story'], ['🧩', 'Color match', 'Find all four matching pairs', 'memory'], ['🌙', 'Little lullaby', 'A quiet original melody', 'lullaby']].forEach(([emoji, title, detail, key]) => {
        const button = document.createElement('button'); button.className = 'activity-tile'; button.innerHTML = '<span aria-hidden="true">' + emoji + '</span><strong>' + title + '</strong><small>' + detail + '</small>';
        button.onclick = () => showActivity(title, window.KidLiteOffline[key]); grid.appendChild(button);
      });
      node.appendChild(grid);
      const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'These activities work without internet after KidLite is installed or visited once.'; node.appendChild(p);
    });
  }
  function showUnfinished(title, message, view) {
    showActivity(title, node => {
      const card = document.createElement('div'); card.className = 'activity-card';
      const icon = document.createElement('div'); icon.className = 'story-illustration'; icon.textContent = '🔒';
      const p = document.createElement('p'); p.className = 'story-text'; p.textContent = message;
      const extra = document.createElement('p'); extra.className = 'muted'; extra.textContent = 'No account, PIN, or content-filtering claims are made until the server-side features are finished.';
      card.append(icon, p, extra); node.appendChild(card);
    }, view);
  }
  document.querySelectorAll('[data-category]').forEach(button => button.onclick = () => showUnfinished(button.dataset.category, 'Parent-approved ' + button.dataset.category.toLowerCase() + ' will appear after secure setup and channel allowlisting are implemented.', 'home'));
  document.getElementById('open-offline').onclick = showOffline;
  navButtons.forEach(button => button.onclick = () => {
    if (button.dataset.view === 'home') showHome();
    else if (button.dataset.view === 'offline') showOffline();
    else if (button.dataset.view === 'shorts') showUnfinished('Shorts', 'Short videos from parent-approved channels are coming in Phase 2.', 'shorts');
    else showUnfinished('Parent controls', 'Parent sign-in and the PIN-protected control panel are coming in Phase 2.', 'parent');
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  let installEvent;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  // Offer native Android install when supported; show accurate iOS instructions otherwise.
  document.getElementById('install-btn').addEventListener('click', () => {
    if (isStandalone()) return;
    if (installEvent) { installEvent.prompt(); installEvent = undefined; }
    else if (isIOS()) { document.getElementById('install-instructions').textContent = 'In Safari, tap Share, then Add to Home Screen.'; document.getElementById('install-dialog').showModal(); }
    else { document.getElementById('install-dialog').showModal(); }
  });
})();
