# KidLite — Phase 1 starter

A lightweight parent-curated PWA foundation. **Not production-ready.**

This project contains a responsive offline-first interface, an offline story, color matching game and original WebAudio lullaby. Hono/Vercel API routes, Clerk middleware, Supabase schema, and a YouTube safe-search URL builder are scaffolded; protected family/video/channel/screen-time features remain unfinished.

## Run locally

1. Install Bun or Node.js 22+.
2. `bun install` (or `npm install`).
3. Copy `.env.example` to `.env` and fill in your own credentials. Do **not** commit `.env`.
4. Import `supabase_schema.sql` into a development Supabase project.
5. Run `bun run check`, `bun run test`, then `bun run dev`.

## Vercel setup

Connect this GitHub repository to Vercel, select the repo root as the project root, and configure the environment variables listed in `.env.example`. Keep `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `YOUTUBE_API_KEY` server-only.

## Project status

- Offline frontend and installable PWA shell — included as a working starter.
- Clerk sign-in, secure parent PIN, family channel whitelist, real video playback and enforced screen-time — **Phase 2 work, not operational yet.**
- YouTube does not guarantee forced 240p playback or suppression of all related videos using embed URL parameters.
- This initial build uses small direct DOM updates rather than the Mango runtime.

See [ROADMAP.md](./ROADMAP.md) for planned milestones.

## Clerk sign-in (Phase 1.5)

The Vanilla JavaScript frontend now supports Clerk **Sign in / Create account** using only `CLERK_PUBLISHABLE_KEY`.
1. In Vercel → Project → Settings → Environment Variables add `CLERK_PUBLISHABLE_KEY=pk_test_...` (or your matching production key) and redeploy.
2. Open the KidLite site. The Clerk auth widget should appear, and a signed-in parent sees the home dashboard and Clerk account button.
3. Offline Play works without logging in, even if the network is unavailable after assets have been cached.
4. `CLERK_SECRET_KEY` is still necessary for securely authenticated Hono backend routes; family database, PIN, YouTube allowlist, and screen-time APIs are not yet enabled.
5. The client SDK is loaded from the Clerk domain encoded in your publishable key. The backend exposes only the publishable key via `/api/config`. Keep every secret server-only.

The Clerk Dashboard (for configuring API keys) and the KidLite in-app dashboard are separate.

### Vercel routing and Node ESM fix

- Node's native ESM loader requires `.js` extensions on relative imports in emitted JavaScript. All TypeScript imports use those extensions, while TypeScript resolves corresponding `.ts` sources through `NodeNext`.
- The public index is deployed at `/index.html`. The root `/` uses a redirect to that static file to avoid sending the homepage to the Hono function. Vercel Hono routing automatically handles `/api/*`.
- Node.js is pinned to major 24 for predictable runtime behavior.
- Set `CLERK_PUBLISHABLE_KEY` (not `VITE_CLERK_PUBLISHABLE_KEY`) in the Vercel production environment.

### Static frontend + API function routing fix
The site uses the Vercel **Other** framework preset (`framework: null` in `vercel.json`) so files under `public/` are served by the CDN while `api/config.ts` and `api/health.ts` are dedicated Web API-based Vercel Functions. This prevents conflicts between the Hono preset's route rewriting and the vanilla JavaScript frontend. The remaining Hono modules are a Phase 2 scaffold and not active user-facing endpoints yet.

## Video-first homepage (Phase 1.6)

- Home is a YouTube-style **long-video feed** rather than the six-category grid.
- Only two channels have been selected: **CoComelon - Nursery Rhymes** (`UCbCmjCuTUZos6Inko4u57UQ`) and **Kids Channel - Cartoon Videos for Kids** (`UC3KknIJZXRygH2pZ6MDtGbg`).
- `GET /api/videos?age=2-5&channel=cocomelon&kind=video&q=abc` applies **server-side filters** to four fixed, manually selected video IDs. Unknown age/channel/kind values are rejected, with no unrestricted YouTube search or autoplay.
- Age values are **subjective suggested suitability**, not a YouTube age-certification or a systematic safety assessment. The selected channels primarily publish preschool content; ages 6–9 and 10–12 currently display a truthful empty state until suitable videos are reviewed.
- YouTube thumbnails are loaded lazily from YouTube. The privacy-enhanced YouTube iframe is instantiated **only after a parent taps a video**, keeping normal player controls, linking to YouTube, and not autoplaying.
- **Shorts** remain a separate navigation item; live YouTube Shorts are not yet reviewed. The **Offline Play** tab contains the old colorful six-card bento grid plus original local, tap-through mini stories and games. No YouTube content is cached or downloaded.
- YouTube may show ads, related videos and external links in its embeds. The app cannot technically guarantee ad-free or fully controlled playback.
- **Before public child-directed launch:** designate the site as child-directed in the applicable Google/YouTube developer tools, review YouTube child-directed policies, check Made For Kids status/embedding permission, obtain legal privacy review, enable and verify Parent PIN and screen-time enforcement, and test with real parents. The current prototype is not a fully audited child-safe product.

## Tamil channels, top search and real YouTube fetch (Phase 1.7)

**Requested navigation**
- Top bar has the cheerful KidLite logo, expandable search icon, notifications (empty until a real notification service exists), Clerk profile button, and install shortcut. No offline-status pill in the header.
- Bottom bar retains Home, Shorts, Offline Play and Settings. The offline item gets a green indicator only after all critical first-party offline assets have been confirmed in the local cache.
- Search field is hidden until the top search icon is tapped. The age selector and fixed, parent-selected channel chips remain in the video feed.

**Allowlisted channels**
CoComelon, Kids Channel, ChuChu TV Tamil, Pattampoochi, Infobells Tamil, Shemaroo Kids Tamil, Chutty Kannamma, and Kids TV Tamil. IDs are either verified static channel IDs or resolved from fixed official YouTube handles. A child cannot add arbitrary channels or submit an unrestricted YouTube search request.

**YouTube integration**
The server-only `YOUTUBE_API_KEY` is used for `channels.list`, `playlistItems.list`, and `videos.list`, not sent to browsers. Calls are cached for 30 minutes per channel in a warm function and by Vercel for 15 minutes, reducing API quota. Search and age filters are applied to metadata returned from these fixed channels. Main video feed falls back to four older manually selected videos if the API is unavailable. The Shorts feed never fabricates content; it shows an honest unavailable/empty state without a working key.

**Shorts limitation:** The YouTube Data API doesn't directly expose whether the video is formally classified as a YouTube Short. KidLite shows clips up to 180 seconds that the uploader tags `#shorts` or `#ytshorts`. Their vertical aspect ratio and YouTube Shorts classification cannot be proven with standard public Data API metadata. YouTube playback and related content remain controlled by YouTube. Therefore this feature is provisional and not a certification of child safety.

Do not launch the child-directed product broadly until YouTube child-directed API-client designation, privacy compliance, server-enforced Parent PIN and child data controls are complete. `CLERK_SECRET_KEY` is configured but presence alone does not finish backend authentication.

## Tamil-first video feed and immersive Shorts (Phase 1.8)

- The Home feed now defaults to the **Tamil** group (six selected Tamil channels). **All** also remains selectable.
- Server uses actual YouTube `publishedAt` metadata to rank **recent Tamil uploads first**. Per-channel limits prevent one prolific uploader from dominating all results. Tamil entries precede other channels in the All feed.
- A **NEW** badge appears only on Tamil videos with a parseable publish date in the last 14 days.
- The bottom **Shorts** tab opens a fullscreen 9:16 player directly rather than a list. The title/playlist UI and bottom navigation are hidden during Shorts playback; a Back control exits. Only **one YouTube iframe at a time** is kept in the DOM, and switching clips destroys the previous iframe to stop playback.
- Arrow Up/Down or Page Up/Down, mouse-wheel (outside the iframe), and swipe from the **dark margins around the player** navigate Shorts. Because YouTube's player is a cross-origin iframe, a swipe performed on top of its video surface cannot reliably be captured by KidLite; covering the player with a gesture overlay would obstruct YouTube controls and is intentionally not implemented.
- Normal videos stay inside KidLite in the privacy-enhanced YouTube player. The app's own verbose "Open on YouTube" text has been replaced by a compact, accessible YouTube icon. **YouTube may still show "Watch on YouTube", its branding, player controls, ads or related videos inside its iframe; these must not be cropped, obscured, or misrepresented.**
- This is still a development preview. Server-enforced per-family channel approval, child safety review, YouTube child-directed app designation, PIN and screen-time limits remain outstanding.

## Phase 1.9 — Clean Home header and four suggestions

- Removed the Videos heading, YouTube source badge, age selector and explanatory block above the channel chips. The collapsed search field stays exclusively in the top navigation and opens on icon tap.
- Home begins with the Tamil-first channel chips followed immediately by video thumbnails. Server filtering remains restricted to the fixed allowlisted channels; the client requests age=all because the visible age selector was removed.
- Clicking a normal video opens the in-app YouTube embed, with **up to four** additional videos underneath. Suggestions come only from the currently server-returned, approved-channel feed, prefer the current channel, exclude the current video, and never add external arbitrary suggestions. A narrow search can yield fewer than four.
- Native YouTube embed annotations and end-screen suggestions cannot be guaranteed hidden from inside its cross-origin player. The four-item cap applies to KidLite's own suggestions only.

- A distinct **Originals** channel chip is retained as an honest empty state until KidLite-owned original videos are published. It is not mapped to external YouTube videos.

## Phase 1.10: Mobile performance
- Home adds only 7 video cards at a time with IntersectionObserver, rather than rendering the entire 45-card batch immediately.
- Cancel outdated video queries on channel/search changes, keep a 3-minute in-memory query cache (up to ten keys) and preserve scroll position after returning from the in-app player.
- Shorts uses 42–45 px side swipe rails and large previous/next tap controls, plus desktop wheel and keyboard navigation. Swiping on the cross-origin YouTube iframe itself remains under YouTube's control.
- Only one YouTube player exists during Shorts playback. Navigating to the next clip destroys the prior iframe. Thumbnail prefetching was removed to reduce data usage.
- The app shell/service worker cache moved to v9, and YouTube audiovisual content remains uncached.
- This is an engineering performance pass, not a measured speed guarantee; actual phones still need manual scrolling/playback tests.

## Phase 1.11 — Fullscreen Shorts and offline metadata catalogue

- Shorts player enlarged: invisible 14–17 px edge swipe strips replace visible Previous/Next arrows, and supported mobile browsers request fullscreen. PWA manifest advertises fullscreen with standalone fallback. YouTube still owns gestures inside its iframe.
- Added IndexedDB catalogue metadata sync, online refresh, deletion of stale/disappeared titles after a successful full refresh, low data/entry count caps, and manual sync/clear under Offline Play.
- Last saved video titles are viewable without internet but explicitly **not playable** as YouTube video downloads are not allowed without approval; original offline stories/games remain available.
- Service worker version v10 precaches only first-party app assets, excluding remote video content.
- See docs/OFFLINE_ARCHITECTURE_V2.md for limits and the rights-cleared media strategy.

## Phase 1.12 — First-visit install and unseen-first Shorts

- Remove the top-bar Download icon **in both normal browser and installed PWA modes**. The first ordinary browser visit shows a centered, dismissible **Add to Home Screen** dialog; subsequent visits do not nag. An explicit Settings entry opens it again when not installed.
- On Android/compatible browsers the button opens the native `beforeinstallprompt.prompt()` from a user gesture, when available. On iOS Safari there is **no programmatic installation**: the dialog walks the user through Share → Add to Home Screen. Installed PWA modes are detected via display-mode and `navigator.standalone`; invitation is suppressed.
- Shorts API now supports pagination (`page=0..11`, 20 results per page) using the fixed channel allowlist, with recent Tamil videos sorted first. The client fetches additional **metadata pages** as the user approaches the end, not additional iframe players. The currently displayed Shorts are remembered as a bounded set of local video IDs (last 600, stored on-device only), and skipped across sessions. A clip is marked as shown when it is rendered; playback completion cannot be observed reliably through a cross-origin iframe.
- When the approved-source pool is exhausted, the app shows a caught-up message and offers **explicit replay**, not an automatic loop. There cannot be an infinite supply of genuinely new videos if the approved channels have no new uploads; the API freshness depends on YouTube and cache TTL.
- User-requested swipe **beginning on top of a YouTube iframe** cannot be captured cross-origin. We preserve the native YouTube player surface, ads, attribution and controls rather than overlaying a transparent gesture-capture layer. Gestures work on the app-owned edge and letterbox regions. Truly native full-video swipe would require the official YouTube Shorts experience or rights-cleared self-hosted videos.
- This is a code-level improvement; mobile touch UX, browser installation variations and video pagination still require device E2E testing.

## Phase 1.13 — Faster YouTube Shorts transitions

- Shorts now uses **one official IFrame Player API instance** with enablejsapi=1 and origin-bound control, calling player.loadVideoById(nextId) when swiping instead of reconstructing an iframe each time.
- The Player API script is requested in parallel with metadata. An API failure watchdog falls back to changing the URL of the existing single iframe; the player is destroyed when leaving the viewer.
- Only previous/current/next **metadata** is kept in a virtual window. At most two small next-video thumbnails are prefetched when Data Saver is off. No hidden YouTube video players or streams are prefetched.
- Connection hints are added for YouTube API, privacy-enhanced player and ytimg.
- Posters are applied **behind** the interactive official YouTube iframe, not as overlays on controls/ads. The background is removed on the PLAYING event. Autoplay-block events are handled.
- This reduces repeated iframe startup overhead but **cannot guarantee zero-delay or 0.2-second video transitions**. Real-device performance measurement is still required.

## Phase 1.14 — Now Playing fullscreen/landscape (compliant)

- In normal long-video playback, KidLite hides its duplicate "Now Playing" page heading and uses a compact row with the YouTube attribution/link and an **Expand** button positioned OUTSIDE the official YouTube iframe. Four approved-channel "Up next" suggestions remain.
- The in-app Expand button calls requestFullscreen on a local **player-shell** container from a user gesture, then attempts screen.orientation.lock('landscape') after fullscreen resolves. On exit/navigation it unlocks orientation and removes fullscreen listeners.
- The fullscreen toolbar offers a distinct Exit button and an honest rotate-phone message when orientation lock is unsupported or denied. Screen Orientation Lock is browser/platform dependent (not guaranteed on iOS Safari, or when device OS disallows rotation).
- YouTube's native title, logo, settings, CC, controls and ads remain unobstructed. We DO NOT crop the iframe or add a touch shield covering the player, which would conflict with YouTube's branding/player requirements.
- Service-worker application-shell cache version v13. Live mobile landscape verification is still needed.

## Phase 1.15 — Minimal Shorts playback UI

- Shorts alone uses the official documented YouTube embed `controls=0` and `fs=0` parameters, keeping the existing privacy-enhanced iframe and all mandatory YouTube branding/ads. Long-video playback is unchanged.
- Captions are **not forced on** (`cc_load_policy=0`), but this does NOT ensure that every user/device will show captions off: YouTube may honor the viewer's preference. There is no supported absolute captions-off guarantee.
- A single small accessible Play/Pause button is positioned at the app's top-right edge; playback uses the official IFrame API `playVideo()`/`pauseVideo()`. Space/K keys and tapping the app-owned black margins also toggle playback; vertical swipes on app-owned margins change Shorts.
- The YouTube iframe is still fully interactive; it is **not** covered by a transparent gesture shield and does **not** use `pointer-events:none`. Touches beginning in the iframe cannot be intercepted cross-origin.
- If the YouTube JavaScript API fails to initialize, the single iframe falls back to native player controls, preserving basic playback accessibility.
- Service Worker shell cache bumped to v14.

## Phase 1.16 — Smart Feed Freshness Engine + three new channels

### Selected new channels
- **Bumble Zoop** — fixed handle @bumblezoop (construction/toy vehicles).
- **Bachpan Ki Duniya** — specifically the Hindi nursery rhymes channel @BachpanKiDuniya-b1j, ID UCsgUAZo732z8mXKZClgrHiA. Several unrelated channels use that name; parents can update this mapping after verifying the intended URL.
- **Bibo Toys** — ID UCWda0RFPFeV2TO54PNxTMmA, handle @bibotoys.

Their source IDs/handles are fixed server-side, never user-supplied to the YouTube API. These additions require parental content moderation; channel membership is not proof that every upload suits ages 2–12.

### Feed and quota
- The existing server already reads **up to 50 upload entries per channel** using `playlistItems.list` (1 quota unit per call), with additional `channels.list` and `videos.list` calls. Channel metadata caches stay 30 minutes; API responses keep CDN cache TTLs. The free-tier daily quota is limited.
- Server forms a **deep, round-robin and newest-first stable pool** and surfaces up to ~170 long videos for the All feed / ~200 Shorts across 20-item pages when the channels provide enough eligible content. Every selected source has a chance to appear. The first slots interleave Tamil and the three featured newcomers.
- Home now defaults to **All**, preserving a dedicated Tamil filter and new single-channel filters.
- A lightweight standalone `freshness.js` implements per-session Fisher–Yates shuffle on the CLIENT, unseen-first with a bounded 500-ID `localStorage` history. IDs are only marked watched when a child opens a normal video. Shorts already retain their separate 600-ID shown history; Shorts now shuffle fetched unseen items per session.
- The refresh icon and top-of-feed passive pull gesture generate a new local seed and bypass the 3-minute client cache. **No random seed is sent to the YouTube Data API** because that would defeat CDN caching, inflate quota usage and provide no genuinely new source videos.
- Reordering a finite pool is NOT identical to discovering newly uploaded videos. Truly new titles arrive when the approved channel uploads and the server/CDN freshness window expires. The application never invents video IDs.
- `freshness.js` is precached in Service Worker shell v15; no YouTube media content is precached.

## Phase 1.17 — True viewport-sized players and fullscreen approved suggestions

- **Long-video Expand:** Replaced the former 16:9/centered-box CSS constraints with a viewport-sized, flexible iframe container. Landscape fullscreen retains auto orientation-lock where supported and a compact 42px toolbar. The actual picture remains aspect-fit within the official YouTube player (no video crop, stretch or fake resolution increase).
- Fullscreen toolbar includes an **Up next (up to 4)** control. Suggestions open in a separate, browser-native horizontal shelf beneath the player, never on top of or obscuring the official YouTube iframe. The player is largest when the shelf is closed.
- Clicking one of the 4 approved suggestions **while in fullscreen** changes the current iframe video and regenerates suggestions without exiting fullscreen or resetting orientation. In-app normal-player suggestions also use the same allowlisted switch logic.
- **Shorts:** Removed previous 9:16 artificial box-size limits; the official privacy-enhanced YouTube iframe now fills the full available portrait viewport between narrow gesture margins. The YouTube video inside may still letterbox depending on source aspect ratio, which cannot lawfully be cropped or stretched.
- Shorts is now swipe-centric: removed the extra app Play/Pause widget and tap-to-pause border actions. In case autoplay fails, revert to official YouTube controls rather than leaving the child with an unplayable video. Swipe start on the cross-origin YouTube player is **not intercepted**; blocking it with a transparent touch shield would interfere with YouTube player functionality.
- Offline shell service-worker cache version v16. Build and mobile-browser responsiveness must be verified for true device-specific fullscreen orientation.

## Phase 1.18 — Pinned All tab, pull refresh and kid-first Shorts swipe

- **All is permanently first:** selected dark/black chip stays fixed at the start of the channel row, while Tamil, Bumble Zoop, Bachpan Ki Duniya, Bibo Toys and the other channels scroll separately to its right.
- **No Refresh button:** the circular icon is removed. Pull down more than 95px while Home is at the top to reseed and refresh the existing approved metadata feed. CDN/YouTube quota behavior remains unchanged.
- **Kids gesture experiment:** Shorts adds a transparent fullscreen swipe-detection region so a vertical drag of at least 40px starting over any part of the video goes to the next/previous approved Short. No play/pause control is added. The Back button remains above the touch surface. When YouTube autoplay/JS API fails, the region yields pointer interaction to native player controls; Replay/Retry is also reachable.
- **YouTube compliance warning:** this experimental gesture surface intercepts taps/gestures intended for YouTube's embedded player, including possible advertising/attribution interactions, and is **likely inconsistent** with YouTube API Services embedded-player interaction requirements. Do not consider this production-compliant without written approval from YouTube or a switch to rights-cleared, native KidLite video files. There is a risk of player/API restriction.
- This is code and endpoint validation, not a successful real-device swipe test. The gesture layer may behave differently on iOS Safari and Android browsers.
- Service Worker cache v17.
