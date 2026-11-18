import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = relative => readFileSync(path.join(root, relative), 'utf8');
test('PWA manifest has root scope and local icons', () => {
  const manifest = JSON.parse(file('public/manifest.json'));
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) assert.ok(existsSync(path.join(root, 'public', icon.src)));
});
test('Offline assets referenced by worker all exist', () => {
  const worker = file('public/sw.js');
  const match = worker.match(/const OFFLINE_ASSETS = (\[.*?\]);/);
  assert.ok(match);
  const assets = JSON.parse(match[1].replace(/'/g, '"'));
  for (const asset of assets) if (asset !== '/') assert.ok(existsSync(path.join(root, 'public', asset)), asset);
});
test('Frontend shell includes required offline game entrypoint', () => {
  assert.match(file('public/index.html'), /offline-games\.js/);
  assert.match(file('public/offline-games.js'), /KidLiteOffline/);
});
test('Private secrets never embedded in publicly served files', () => {
  for (const name of ['index.html','app.js','offline-games.js','sw.js','styles.css']) {
    assert.doesNotMatch(file('public/' + name), /SUPABASE_SERVICE_ROLE_KEY|CLERK_SECRET_KEY|YOUTUBE_API_KEY/);
  }
});
test('Offline shell stays lightweight', () => {
  const files = ['index.html','styles.css','app.js','offline-games.js','sw.js'];
  const bytes = files.reduce((sum, f) => sum + statSync(path.join(root, 'public', f)).size, 0);
  assert.ok(bytes < 2_000_000);
});

test('Clerk frontend wiring is present and uses the public key config endpoint', () => {
  assert.match(file('public/index.html'), /id="auth-screen"/);
  assert.match(file('public/index.html'), /src="\/auth\.js"/);
  assert.match(file('public/auth.js'), /fetch\('\/api\/config'/);
  assert.match(file('public/auth.js'), /clerk\.mountSignIn/);
  assert.match(file('public/auth.js'), /clerk\.mountSignUp/);
  assert.match(file('public/auth.js'), /session\.getToken/);
});

test('Compact top search and 4 tabs stay wired', () => {
  const html = file('public/index.html');
  assert.match(html, /id="search-toggle"/);
  assert.match(html, /id="notification-toggle"/);
  assert.match(html, /id="header-search"[^>]*hidden/);
  assert.match(html, /id="video-query"/);
  assert.match(html, /data-view="settings"/);
  assert.match(html, /id="offline-ready-indicator"/);
  assert.doesNotMatch(html, /class="offline-status"/);
  assert.doesNotMatch(html, /id="parent-btn"/);
  assert.match(file('public/styles.css'), /font-family:"Inter"/);
  assert.match(file('public/app.js'), /function showSettings\(/);
  assert.match(file('public/app.js'), /function showShorts\(/);
  assert.ok(existsSync(path.join(root, 'public/icons/kidlite-mark.svg')));
});
test('Video home and offline grid have separate navigation destinations', () => {
  const html = file('public/index.html');
  assert.match(html, /id="video-feed"/);
  assert.match(html, /id="age-select"/);
  assert.match(html, /id="video-query"/);
  assert.match(html, /data-channel="cocomelon"/);
  assert.match(html, /data-channel="kidschannel"/);
  assert.doesNotMatch(html, /class="categories"/);
  assert.match(file('public/app.js'), /function showOffline\(/);
  assert.match(file('public/app.js'), /function showVideo\(/);
  assert.match(file('public/app.js'), /function showSettings\(/);
});
test('Only fixed approved YouTube sources can appear in the server feed', () => {
  const api = file('api/videos.ts');
  assert.match(api, /UCbCmjCuTUZos6Inko4u57UQ/);
  assert.match(api, /UC3KknIJZXRygH2pZ6MDtGbg/);
  assert.match(api, /Invalid filter/);
  assert.match(api, /YOUTUBE_API_KEY/);
  assert.match(api, /youtube\/v3/);
  assert.match(api, /forHandle/);
  assert.match(api, /#\(\?:shorts/);
  assert.match(file('public/app.js'), /www\.youtube-nocookie\.com\/embed/);
});

test('Selected Tamil channel handles and server Shorts fetch are present', () => {
  const html = file('public/index.html');
  const api = file('api/videos.ts');
  for (const key of ['chuchutamil','pattampoochi','infobellstamil','shemarootamil','chuttykannamma','kidstvtamil']) {
    assert.ok(html.includes('data-channel="' + key + '"'), key);
    assert.ok(api.includes(key), key);
  }
  assert.match(api, /playlistItems/);
  assert.match(api, /contentDetails/);
  assert.match(file('public/app.js'), /kind:'short'/);
  assert.match(file('public/app.js'), /kidlite-offline-v6/);
});
