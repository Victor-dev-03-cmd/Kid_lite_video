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
  assert.match(file('public/app.js'), /kidlite-offline-v18/);
});

test('Tamil feed prioritized and recent uploads sorted server-side', () => {
  const api = file('api/videos.ts');
  const html = file('public/index.html');
  assert.match(api, /TAMIL_KEYS/);
  assert.match(api, /publishedAt/);
  assert.match(api, /recentBalanced/);
  assert.match(api, /channel==='tamil'/);
  assert.match(html, /data-channel="tamil" aria-pressed="false"/);
  assert.match(html, /data-channel="all" aria-pressed="true"/);
  assert.match(file('public/app.js'), /channel:'all'/);
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
test('Normal video player interleaves up to twelve approved suggestions', () => {
  const app = file('public/app.js');
  assert.match(app, /const candidates = selected => \{/);
  assert.match(app, /SUGGESTION_LIMIT = 12/);
  assert.match(app, /item\.id !== selected\.id/);
  assert.match(app, /validVideo\(item\)/);
  assert.match(app, /button\.onclick = \(\) => changeVideo\(suggested\)/);
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
  assert.match(js, /new Image\(/);
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
  assert.match(worker,/kidlite-offline-v18/);
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
  assert.match(app,/kidlite-offline-v18/);
});

test('First-visit browser install invitation replaces top install button',()=>{
  const html=file('public/index.html'),js=file('public/install.js');
  assert.doesNotMatch(html,/id="install-btn"/);
  assert.match(html,/id="install-dialog"/);
  assert.match(html,/id="install-action"/);
  assert.match(html,/id="install-later"/);
  assert.match(html,/src="\/install\.js"/);
  assert.match(js,/beforeinstallprompt/);
  assert.match(js,/appinstalled/);
  assert.match(js,/display-mode: standalone/);
  assert.match(js,/display-mode: fullscreen/);
  assert.match(js,/navigator\.standalone/);
  assert.match(js,/prompt\.userChoice/);
  assert.match(js,/Share/);
});
test('Shorts retain local seen IDs and page through fresh approved content',()=>{
  const js=file('public/shorts.js'),api=file('api/videos.ts');
  assert.match(js,/SEEN_KEY/);
  assert.match(js,/markShown\(video\.id\)/);
  assert.match(js,/page:String\(s\.page\)/);
  assert.match(js,/seen\.has\(v\.id\)/);
  assert.match(js,/Replay watched Shorts/);
  assert.match(js,/s\.pendingNext/);
  assert.match(api,/pageRaw/);
  assert.match(api,/hasMore/);
  assert.match(api,/nextPage/);
  assert.match(api,/perPage=20/);
  assert.match(api,/s-maxage=180/);
});

test('Single YouTube IFrame API player is reused across Shorts',()=>{
  const js=file('public/shorts.js');
  assert.match(js,/new YT\.Player\(s\.frame/);
  assert.match(js,/enablejsapi:'1'/);
  assert.match(js,/origin:location\.origin/);
  assert.match(js,/s\.player\.loadVideoById\(video\.id\)/);
  assert.match(js,/onStateChange/);
  assert.match(js,/PlayerState\.PLAYING/);
  assert.match(js,/onAutoplayBlocked/);
  assert.match(js,/apiWatchdog/);
  assert.match(js,/disposePlayer\(session\)/);
  assert.match(js,/virtualWindow/);
  assert.match(js,/s\.preparedThumbnails/);
  assert.match(js,/new Image\(\)/);
});
test('Player connection hints and compliant poster background',()=>{
  const html=file('public/index.html'),css=file('public/styles.css'),js=file('public/shorts.js');
  assert.match(html,/preconnect" href="https:\/\/www\.youtube\.com"/);
  assert.match(html,/preconnect" href="https:\/\/www\.youtube-nocookie\.com"/);
  assert.match(html,/preconnect" href="https:\/\/i\.ytimg\.com"/);
  assert.match(html,/dns-prefetch/);
  assert.match(css,/background-position:center center/);
  assert.match(js,/style\.backgroundImage/);
});

test('Now Playing has a compliant external Expand button and conditional landscape lock',()=>{
  const app=file('public/app.js'),css=file('public/styles.css');
  assert.match(app,/showActivity\('Watch video'/);
  assert.match(app,/className = 'player-shell'/);
  assert.match(app,/className = 'player-expand'/);
  assert.match(app,/shell\.requestFullscreen\(\{navigationUI:'hide'\}\)/);
  assert.match(app,/window\.screen\.orientation\.lock\('landscape'\)/);
  assert.match(app,/window\.screen\.orientation\?\.unlock\?\.\(\)/);
  assert.match(app,/fullscreenchange/);
  assert.match(app,/activeVideoSession = \{dispose\}/);
  assert.match(app,/typeof window\.screen\.orientation\?\.lock === 'function'/);
  assert.match(app,/Rotate your phone if landscape is unavailable/);
  assert.match(app,/window\.screen\.orientation\?\.unlock/);
  assert.match(css,/\.player-shell:fullscreen/);
  assert.match(css,/\.player-fullscreen-toolbar/);
});
test('Now Playing never crops or shields YouTube embedded controls',()=>{
  const app=file('public/app.js'),css=file('public/styles.css');
  assert.match(app,/youtube-nocookie\.com\/embed/);
  assert.match(app,/frame\.allowFullscreen = true/);
  assert.match(app,/youtube-icon-link/);
  assert.match(app,/result\.length < SUGGESTION_LIMIT/);
  assert.doesNotMatch(app,/player-touch-shield|youtube-crop|controls=0/);
  assert.doesNotMatch(css,/height:\s*calc\(100%\s*\+\s*120px\)/);
  assert.doesNotMatch(css,/margin-top:\s*-60px/);
  assert.doesNotMatch(css,/\.player-touch-shield/);
});

test('Shorts exposes only the requested pause control without masking the YouTube player',()=>{
  const js=file('public/shorts.js');
  const css=file('public/styles.css');
  assert.match(js,/controls:nativeControls\?'1':'0'/);
  assert.match(js,/fs:nativeControls\?'1':'0'/);
  assert.match(js,/cc_load_policy:'0'/);
  assert.doesNotMatch(js,/className='shorts-pause-toggle'/);
  assert.match(js,/function togglePlayback\(\)/);
  assert.match(js,/s\.player\.pauseVideo\(\)/);
  assert.match(js,/s\.player\.playVideo\(\)/);
  assert.doesNotMatch(js,/pauseButton\.onclick=togglePlayback/);
  assert.match(js,/function activateNativeControls\(s\)/);
  assert.match(js,/youtubeEmbed\(s\.requestedId\|\|s\.initialId,true\)/);
  assert.match(css,/\.shorts-pause-toggle\{/);
  assert.doesNotMatch(css,/\.shorts-player iframe\s*\{[^}]*pointer-events\s*:\s*none/);
  assert.doesNotMatch(js,/touch-shield|gesture-overlay/);
});
test('Shorts swipe remains the primary touch gesture without accidental pause taps',()=>{
  const js=file('public/shorts.js');
  assert.match(js,/navigate\(dy < 0 \? 1 : -1\)/);
  assert.match(js,/shorts-swipe-rail/);
  assert.doesNotMatch(js,/overlay\.append\(stage,back,pauseButton,description\)/);
  assert.match(js,/event\.key===' ' \|\| event\.key==='k'/);
});

test('Three verified selected kids-channel identities appear in server and channel chips',()=>{
  const html=file('public/index.html'),api=file('api/videos.ts'),app=file('public/app.js');
  const shorts=file('public/shorts.js'),catalog=file('public/catalogue.js');
  for(const key of ['bumblezoop','bachpankiduniya','bibotoys']){
    assert.match(html,new RegExp('data-channel="'+key+'"'));
    assert.ok(api.includes(key));
    assert.ok(app.includes(key));
    assert.ok(shorts.includes(key));
    assert.ok(catalog.includes(key));
  }
  assert.match(api,/UCsgUAZo732z8mXKZClgrHiA/);
  assert.match(api,/UCWda0RFPFeV2TO54PNxTMmA/);
  assert.match(api,/@bumblezoop/);
  assert.match(api,/FEATURED_KEYS/);
  assert.match(html,/data-channel="all" aria-pressed="true"/);
});
test('Uploads playlist searches 50 per selected channel and serves a deep balanced feed',()=>{
  const api=file('api/videos.ts');
  assert.match(api,/playlistItems/);
  assert.match(api,/maxResults:'50'/);
  assert.match(api,/cache\.set\(channelKey,\{until:Date\.now\(\)\+30\*60\*1000,videos\}\)/);
  assert.match(api,/recentBalanced/);
  assert.match(api,/weaveGroups/);
  assert.match(api,/kind==='short'\?200:170/);
  assert.match(api,/perPage=20/);
  assert.match(api,/s-maxage=180/);
});
test('Browser seed and watched-video history shuffle unseen videos first',()=>{
  const js=file('public/freshness.js'),app=file('public/app.js');
  assert.match(js,/function shuffle\(items,seed=1\)/);
  assert.match(js,/Math\.floor\(rng\(\)\*\(i\+1\)\)/);
  assert.match(js,/function readSeen\(\)/);
  assert.match(js,/function markWatched\(videoId\)/);
  assert.match(js,/const seen=new Set\(readSeen\(\)\)/);
  assert.match(js,/return \[\.\.\.spread\(ranked\[0\]/);
  assert.match(app,/freshness\.order\(videos/);
  assert.match(app,/freshness\?\.markWatched\(video\.id\)/);
  assert.match(app,/state\.feedSeed=freshness\?\.createSeed\(\)/);
});
test('Refresh uses fresh local seed without duplicating YouTube provider calls',()=>{
  const html=file('public/index.html'),app=file('public/app.js'),shorts=file('public/shorts.js');
  assert.doesNotMatch(html,/id="feed-refresh"/);
  assert.match(html,/src="\/freshness\.js"/);
  assert.match(app,/function refreshFeed\(\)/);
  assert.match(app,/loadVideos\(\{force:true\}\)/);
  assert.match(app,/home\.addEventListener\('touchstart'/);
  assert.match(app,/home\.addEventListener\('touchend'/);
  assert.match(app,/if \(!options\.force && old/);
  assert.match(shorts,/KidLiteFreshness\.shuffle\(batch/);
  assert.match(shorts,/sessionSeed:/);
  const sw=file('public/sw.js');
  assert.match(sw,/\/freshness\.js/);
  assert.match(sw,/kidlite-offline-v18/);
});

test('Expanded videos show a permanent swipeable suggested-thumbnail strip',()=>{
  const app=file('public/app.js'),css=file('public/styles.css');
  assert.match(css,/\.player-shell:fullscreen/);
  assert.match(css,/width:100vw!important/);
  assert.match(css,/height:100dvh!important/);
  assert.match(css,/flex:1 1 0%!important/);
  assert.match(css,/aspect-ratio:auto!important/);
  assert.match(css,/\.player-fullscreen-recommendation-list/);
  assert.match(css,/\.player-fullscreen-recommendations\[hidden\]/);
  assert.doesNotMatch(app,/className = 'player-fullscreen-next-toggle'/);
  assert.match(app,/className = 'player-fullscreen-recommendations'/);
  assert.match(app,/compact \? 'player-fullscreen-suggestion'/);
  assert.match(app,/button\.onclick = \(\) => changeVideo\(suggested\)/);
  assert.match(app,/frame\.src = videoUrl\(current\)/);
  assert.match(app,/window\.screen\.orientation\.lock\('landscape'\)/);
  assert.match(app,/SUGGESTION_LIMIT = 12/);
});
test('Shorts player fills device height without cropping YouTube or covering its controls',()=>{
  const css=file('public/styles.css'),js=file('public/shorts.js');
  assert.match(css,/\.shorts-video-slot \.shorts-player\{/);
  assert.match(css,/width:100%!important/);
  assert.match(css,/height:100%!important/);
  assert.match(css,/aspect-ratio:auto!important/);
  assert.doesNotMatch(js,/className='shorts-pause-toggle'/);
  assert.doesNotMatch(js,/touch-shield|gesture-overlay/);
  assert.match(js,/onAutoplayBlocked/);
  assert.match(js,/activateNativeControls\(s\)/);
});

test('All is pinned permanently first in black; other channel chips can scroll',()=>{
  const html=file('public/index.html'),css=file('public/styles.css');
  const shell=html.indexOf('class="channel-tabs-shell"');
  const all=html.indexOf('data-channel="all"',shell);
  const tabs=html.indexOf('class="channel-tabs"',shell);
  const tamil=html.indexOf('data-channel="tamil"',shell);
  assert.ok(shell>=0 && all>shell && tabs>all && tamil>tabs);
  assert.match(html,/class="channel-chip selected pinned-all-chip"/);
  assert.match(css,/\.channel-tabs-shell \.pinned-all-chip/);
  assert.match(css,/background:#111116/);
});
test('Pull to refresh still reseeds the feed with no visible Refresh button',()=>{
  const app=file('public/app.js'),html=file('public/index.html');
  assert.doesNotMatch(html,/id="feed-refresh"|class="feed-refresh-button"/);
  assert.doesNotMatch(app,/refreshButton/);
  assert.match(app,/function refreshFeed\(\)/);
  assert.match(app,/state\.feedSeed=freshness\?\.createSeed\(\)/);
  assert.match(app,/home\.addEventListener\('touchstart'/);
  assert.match(app,/home\.addEventListener\('touchend'/);
  assert.match(app,/dy>95/);
  assert.match(app,/loadVideos\(\{force:true\}\)/);
});
test('Full-viewport Shorts gesture layer captures swipes from anywhere',()=>{
  const js=file('public/shorts.js'),css=file('public/styles.css');
  assert.match(js,/className='shorts-full-swipe-surface'/);
  assert.match(js,/overlay\.append\(stage,swipeSurface,back,description\)/);
  assert.match(js,/swipeSurface\.addEventListener\('pointerdown'/);
  assert.match(js,/swipeSurface\.addEventListener\('pointerup'/);
  assert.match(js,/Math\.abs\(dy\)>=40/);
  assert.match(js,/navigate\(dy<0\?1:-1\)/);
  assert.match(js,/pointerEvents=retry\?'none':'auto'/);
  assert.match(js,/s\.swipeSurface\.style\.pointerEvents='none'/);
  assert.match(css,/\.shorts-full-swipe-surface\{/);
  assert.match(css,/touch-action:none/);
  assert.match(css,/\.shorts-back\{z-index:8!important\}/);
});

test('Expanded long video shelf has no Up next button and exposes twelve suggestions',()=>{
  const app=file('public/app.js'),css=file('public/styles.css');
  assert.match(app,/const SUGGESTION_LIMIT = 12/);
  assert.match(app,/eligible\.filter\(item => item\.channelKey === selected\.channelKey\)/);
  assert.match(app,/eligible\.filter\(item => item\.channelKey !== selected\.channelKey\)/);
  assert.match(app,/result\.push\(discover\[d\+\+\]\)/);
  assert.match(app,/toolbar\.append\(exit,fullLabel\)/);
  assert.doesNotMatch(app,/upNext\.onclick/);
  assert.doesNotMatch(app,/player-fullscreen-next-toggle/);
  assert.match(app,/expandedSuggestions\.hidden = results\.length === 0/);
  assert.match(app,/fullscreenList\.replaceChildren/);
  assert.match(app,/suggestionsList\.replaceChildren/);
  assert.match(app,/button\.onclick = \(\) => changeVideo\(suggested\)/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/touch-action:pan-x/);
  assert.match(css,/height:82px!important/);
});
