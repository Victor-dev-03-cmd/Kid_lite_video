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
  assert.match(file('public/shorts.js'), /kind:'short'/);
  assert.match(file('public/app.js'), /kidlite-offline-v10/);
});

test('Tamil feed prioritized and recent uploads sorted server-side', () => {
  const api = file('api/videos.ts');
  const html = file('public/index.html');
  assert.match(api, /TAMIL_KEYS/);
  assert.match(api, /publishedAt/);
  assert.match(api, /recentBalanced/);
  assert.match(api, /channel==='tamil'/);
  assert.match(html, /data-channel="tamil" aria-pressed="true"/);
  assert.match(file('public/app.js'), /channel:'tamil'/);
});
test('Shorts tab directly opens one immersive player instead of a list', () => {
  const js = file('public/shorts.js');
  const app = file('public/app.js');
  assert.match(app, /KidLiteShorts\.open/);
  assert.match(js, /s\.slot\.replaceChildren\(\)/);
  assert.match(js, /youtube-nocookie\.com\/embed/);
  assert.match(js, /touchend/);
  assert.match(js, /ArrowDown/);
  assert.match(js, /session\.overlay\.remove\(\)/);
  assert.match(file('public/styles.css'), /body\.shorts-open \.dock/);
  assert.doesNotMatch(app, /Watch Short/);
});

test('Fresh Tamil badge and compact normal-player YouTube link work without hiding embed', () => {
  const app = file('public/app.js');
  const css = file('public/styles.css');
  assert.match(app, /fresh-video-badge/);
  assert.match(app, /youtube-icon-link/);
  assert.match(app, /youtube-nocookie\.com\/embed/);
  assert.match(css, /\.shorts-overlay\{/);
  assert.match(css, /\.fresh-video-badge\{/);
});

test('Home begins with channels; heading, age selector and source banner are removed', () => {
  const html = file('public/index.html');
  const start = html.indexOf('<main id="main-view"');
  const tabs = html.indexOf('class="channel-tabs"', start);
  const feed = html.indexOf('id="video-feed"', tabs);
  assert.ok(start >= 0 && tabs > start && feed > tabs);
  assert.doesNotMatch(html, /class="feed-heading"|class="feed-tools"|id="age-select"|class="youtube-source"/);
  assert.match(html, /id="header-search"[^>]*hidden/);
  assert.match(html, /data-channel="tamil"/);
});
test('Normal video player lists at most four other allowlisted suggestions', () => {
  const app = file('public/app.js');
  assert.match(app, /const suggestions = state\.videos/);
  assert.match(app, /\.slice\(0, 4\)/);
  assert.match(app, /item\.id !== video\.id/);
  assert.match(app, /validVideo\(item\)/);
  assert.match(app, /button\.onclick = \(\) => showVideo\(suggested\)/);
});

test('Originals has an explicit truthful empty state', () => {
  const html = file('public/index.html');
  const app = file('public/app.js');
  assert.match(html, /data-channel="originals"/);
  assert.match(app, /state\.channel === 'originals'/);
  assert.match(app, /Originals videos are coming soon/);
});

test('Shorts support pointer/touch navigation without prefetching video assets', () => {
  const js = file('public/shorts.js');
  const css = file('public/styles.css');
  assert.match(js, /shorts-swipe-rail/);
  assert.match(js, /pointerup/);
  assert.match(js, /touchend/);
  assert.match(js, /s\.slot\.replaceChildren\(\)/);
  assert.match(js, /lastSwitch/);
  assert.doesNotMatch(js, /new Image\(/);
  assert.match(css, /\.shorts-video-slot/);
  assert.match(css, /touch-action:none/);
});
test('Long video feed batches cards and cancels superseded requests', () => {
  const js = file('public/app.js');
  assert.match(js, /FEED_CHUNK = 7/);
  assert.match(js, /new IntersectionObserver/);
  assert.match(js, /appendFeedChunk/);
  assert.match(js, /fetchController\?\.abort\(\)/);
  assert.match(js, /feedCache:new Map/);
  assert.match(js, /returnScrollY/);
  assert.match(js, /requestAnimationFrame/);
});

test('Installed PWA supports fullscreen with fallback and script is locally cached',()=>{
  const manifest=JSON.parse(file('public/manifest.json'));
  assert.equal(manifest.display,'fullscreen');
  assert.ok(manifest.display_override.includes('standalone'));
  const html=file('public/index.html');
  assert.match(html,/src="\/catalogue\.js"/);
  assert.match(html,/apple-mobile-web-app-capable/);
  const worker=file('public/sw.js');
  assert.match(worker,/kidlite-offline-v10/);
  assert.match(worker,/\/catalogue\.js/);
  assert.match(worker,/url\.pathname\.startsWith\('\/api\/'\)/);
});
test('Shorts use full-bleed player, invisible swipe strips and no bulky buttons',()=>{
  const js=file('public/shorts.js'),css=file('public/styles.css');
  assert.match(js,/requestFullscreen/);
  assert.match(js,/shorts-swipe-rail/);
  assert.match(js,/pointerup/);
  assert.match(js,/s\.slot\.replaceChildren\(\)/);
  assert.doesNotMatch(js,/shorts-skip/);
  assert.match(css,/shorts-video-slot \.shorts-player/);
  assert.match(css,/flex-basis:14px/);
});
test('Offline metadata sync is bounded, incremental and keeps YouTube media uncached',()=>{
  const js=file('public/catalogue.js');
  assert.match(js,/indexedDB\.open/);
  assert.match(js,/MAX_ITEMS=1100/);
  assert.match(js,/MAX_CHARS=460000/);
  assert.match(js,/if\(!keep\.has\(old\.key\)\)table\.delete/);
  assert.match(js,/if\(JSON\.stringify\(previous\.get\(item\.key\)\)!==JSON\.stringify\(item\)\)/);
  assert.match(js,/longs\.mode!=='youtube-live'/);
  assert.match(js,/shorts\.mode!=='youtube-live'/);
  assert.match(js,/onlineOnly:true/);
  assert.doesNotMatch(js,/youtube-nocookie\.com\/embed/);
});
test('Offline Play offers saved titles but does not pretend YouTube plays offline',()=>{
  const app=file('public/app.js');
  assert.match(app,/function showSavedCatalogue/);
  assert.match(app,/YouTube playback needs internet/);
  assert.match(app,/window\.KidLiteCatalogue\.synchronize\(true\)/);
  assert.match(app,/window\.KidLiteCatalogue\.clear\(\)/);
  assert.match(app,/kidlite-offline-v10/);
});
