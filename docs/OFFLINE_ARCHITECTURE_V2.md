# KidLite Phase 2: Fullscreen & Lightweight Offline Catalogue

## Fullscreen mobile Shorts
- Installed PWA requests fullscreen manifest mode with standalone fallback. Android Chrome may honor it; iOS support varies and can use standalone. Shorts also tries the Fullscreen API inside the Shorts-tab tap gesture when supported.
- Shorts displays one official privacy-enhanced YouTube iframe at a time. Narrow 14–17 px dark edge strips capture up/down swipe, plus keyboard and wheel input. No visible arrow buttons or extra related-video overlay. Taps on left/right strip also navigate.
- YouTube iframe is a cross-origin surface; gestures that begin directly on the video cannot be intercepted reliably. No transparent layer covers YouTube controls. Mobile field testing is still needed.

## Low-data metadata sync (implemented)
- When the app is open and online, it can sync the available 45 long videos + 30 Shorts served by current API. The API is not currently paginated to 1,100 videos; do not misrepresent the supported count.
- IndexedDB holds only server-validated video IDs, titles, channel name, kind, duration and publishedAt. No video bytes or YouTube thumbnail files are cached.
- Sync at most once every 30 minutes when online, unless user taps Sync. Skip automatic sync on data-saver connections. Only after BOTH API requests succeed without provider warnings do we upsert changed records and delete removed ones in a single transaction.
- Max 1,100 metadata rows and 460,000 JSON characters (an approximate sub-1 MB metadata budget before IndexedDB overhead). Cached entries older than 25 days are hidden and require refresh.
- If offline/API fails, last valid titles may still be browsed from Home or Offline Play, with explicit 'internet required' text and no misleading video play button. Offline games and original story/audio continue independently.
- Settings and Offline Play include a saved-titles list, manual sync and manual clear.
- Caches/Service Worker exclude all /api calls and remote YouTube/Clerk origins.

## What is NOT implemented
- Actual YouTube videos cannot be downloaded, cached, re-hosted, or offered for offline playback without YouTube's prior written approval (YouTube API Services Developer Policies).
- No Supabase Storage videos, no paid bandwidth or storage usage, no migration of video records to Supabase PostgreSQL in this release.
- Before building 100 long + 1,000 Shorts offline pack, secure rights for original media and create a licensed, opt-in download/cache manager with storage quota + LRU eviction.
- Production child safety checks, parent PIN and family-scoped channel allowlist are still outstanding.

## Storage note
Supabase Free 1 GB is file storage, not an automatic browser cache. The metadata cache is on each device in IndexedDB and consumes only a small, bounded amount of device space. Offline original video assets require separate licensing, capacity sizing, download consent and quota policies.