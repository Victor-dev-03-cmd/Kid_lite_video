/* Clerk browser authentication. Only the publishable key enters this file. */
(function () {
  'use strict';
  const state = { signedIn: false, ready: false, clerk: null };
  window.KidLiteAuth = state;
  const authScreen = document.getElementById('auth-screen');
  const loginStatus = document.getElementById('auth-status');
  const signInNode = document.getElementById('clerk-auth-mount');
  const userNode = document.getElementById('clerk-user-button');
  const signUpButton = document.getElementById('switch-auth-mode');
  const dock = document.querySelector('.dock');
  let currentMode = 'signin';
  let mountedMode = null;

  function showMessage(text) {
    loginStatus.textContent = text;
    loginStatus.classList.remove('hidden');
  }
  function showSignedOut() {
    state.signedIn = false;
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('activity-view').classList.add('hidden');
    authScreen.classList.remove('hidden');
    dock.classList.add('hidden');
    userNode.classList.add('hidden');
  }
  function unmountCurrent() {
    if (!state.clerk || !mountedMode) return;
    try {
      if (mountedMode === 'signin') state.clerk.unmountSignIn(signInNode);
      else state.clerk.unmountSignUp(signInNode);
    } catch (error) {
      console.warn('Clerk component cleanup skipped:', error);
    }
    mountedMode = null;
    signInNode.replaceChildren();
  }
  function mountAuth(mode) {
    if (!state.clerk || state.signedIn) return;
    unmountCurrent();
    currentMode = mode;
    signUpButton.textContent = mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in';
    const appearance = { variables: { fontFamily: '"Inter", system-ui, sans-serif' } };
    if (mode === 'signin') state.clerk.mountSignIn(signInNode, { fallbackRedirectUrl: '/', appearance });
    else state.clerk.mountSignUp(signInNode, { fallbackRedirectUrl: '/', appearance });
    mountedMode = mode;
  }
  function showSignedIn() {
    state.signedIn = true;
    authScreen.classList.add('hidden');
    dock.classList.remove('hidden');
    loginStatus.classList.add('hidden');
    unmountCurrent();
    userNode.classList.remove('hidden');
    state.clerk.mountUserButton(userNode);
    window.KidLiteApp.showHome();
  }
  function syncAuth() {
    if (!state.clerk) return;
    const signedIn = Boolean(state.clerk.user && state.clerk.session);
    if (signedIn && !state.signedIn) showSignedIn();
    if (!signedIn && state.signedIn) {
      try { state.clerk.unmountUserButton(userNode); } catch (_) {}
      userNode.replaceChildren();
      showSignedOut();
      mountAuth('signin');
    }
  }
  function addScript(src, extraAttributes) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      element.src = src;
      element.async = true;
      element.crossOrigin = 'anonymous';
      Object.entries(extraAttributes || {}).forEach(([key, value]) => element.setAttribute(key, value));
      element.onload = resolve;
      element.onerror = () => reject(new Error('Clerk sign-in library could not load. Check your network connection.'));
      document.head.appendChild(element);
    });
  }
  function frontendDomain(publishableKey) {
    if (!/^pk_(test|live)_[A-Za-z0-9+/=]+$/.test(publishableKey)) throw new Error('Invalid Clerk Publishable Key format.');
    const decoded = atob(publishableKey.split('_')[2]);
    if (!decoded.endsWith('$')) throw new Error('Invalid Clerk frontend domain.');
    const hostname = decoded.slice(0, -1);
    if (!/^[a-zA-Z0-9.-]+$/.test(hostname) || hostname.startsWith('.') || hostname.endsWith('.')) {
      throw new Error('Invalid Clerk frontend domain.');
    }
    return hostname;
  }
  async function initialize() {
    showSignedOut();
    showMessage('Preparing secure sign-in…');
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to reach the KidLite API.');
      const { clerkPublishableKey } = await response.json();
      if (!clerkPublishableKey) {
        showMessage('Publishable Key missing. Add CLERK_PUBLISHABLE_KEY in Vercel → Settings → Environment Variables, then redeploy.');
        return;
      }
      const domain = frontendDomain(clerkPublishableKey);
      await addScript('https://' + domain + '/npm/@clerk/ui@1/dist/ui.browser.js');
      await addScript('https://' + domain + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', {
        'data-clerk-publishable-key': clerkPublishableKey,
      });
      const clerk = window.Clerk;
      if (!clerk) throw new Error('Clerk did not initialize.');
      await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
      state.clerk = clerk;
      state.ready = true;
      loginStatus.classList.add('hidden');
      clerk.addListener(syncAuth);
      if (clerk.user && clerk.session) {
        if (!state.signedIn) showSignedIn();
      } else mountAuth(currentMode);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Sign-in is unavailable. Try again online.');
    }
  }
  signUpButton.addEventListener('click', () => mountAuth(currentMode === 'signin' ? 'signup' : 'signin'));
  document.getElementById('guest-offline').addEventListener('click', () => {
    authScreen.classList.add('hidden');
    window.KidLiteApp.showOffline();
  });
  state.apiFetch = async (path, options = {}) => {
    if (typeof path !== 'string' || !path.startsWith('/api/')) throw new Error('Only local API paths are allowed.');
    if (!state.signedIn || !state.clerk?.session) throw new Error('Parent sign-in required.');
    const token = await state.clerk.session.getToken();
    if (!token) throw new Error('No active Clerk session token.');
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);
    return fetch(path, { ...options, headers });
  };
  initialize();
})();
