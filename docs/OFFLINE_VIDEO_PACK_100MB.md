# KidLite — 100 MB original offline video pack

## Current status

The device storage manager and UI are implemented, but NO rights-cleared original video files are present yet. The manifest is deliberately empty. YouTube video streams must not be downloaded or cached without YouTube's prior written approval.

## Storage and media limits

- 15 main videos × 3.3 MB = 49.5 MB target.
- 50 Shorts × 0.9 MB = 45 MB target.
- 5 MB estimated app shell/games reserve; 99.5 MB overall target.
- Manager caps media at 95,000,000 bytes and estimates total origin usage against 100,000,000 bytes using navigator.storage.estimate(); browser estimates and external eviction are not exact guarantees.
- Single-asset guards: 5 MB main, 1.5 MB Short. Final counts may be lower than 65 if actual files do not fit.

## Adding verified original files

1. Obtain ownership or an explicit **offline download and redistribution license**, including embedded music and artwork. Independently approve child suitability. Keep rights documents private.
2. Encode in a mobile-supported format and reduce the actual byte sizes. VP9/WebM can be efficient, but device support differs. H.264/AAC MP4 is a widely compatible fallback. AV1/VP9/H.265 support is device-dependent; compression quality and file size cannot be guaranteed. Never convert downloaded YouTube content for offline use.
3. Upload the finished files under public/owned-media/, for example public/owned-media/animals-song.mp4.
4. Add manifest entries to public/offline-video-manifest.json, e.g.:

    {"version":1,"videos":[{"id":"animals_song_01","kind":"main","title":"Animals Song","url":"/owned-media/animals-song.mp4","mime":"video/mp4","sizeBytes":3200000,"sha256":"ACTUAL_64_CHARACTER_SHA256_FROM_UPLOADED_FILE","offlineRights":"owned"}]}

   The above is a SCHEMA EXAMPLE ONLY, not a valid download or a real supplied video; replace size, hash, title and file with verified data. The SHA-256 value must be lowercase hexadecimal, exactly 64 characters. Allowed offlineRights values: owned or licensed-offline. No YouTube URLs.
5. Run npm run check:offline-media. Update production and test actual offline playback on iPhone and Android.

## Download policy

- One file at a time, only after an adult enables downloads.
- Initial batch: up to 5 main + 15 short. Further batches: 2 main + 5 short.
- Optional Wi-Fi auto-updates are OFF by default. They run only while app is open, once per day, when browser explicitly detects Wi-Fi/ethernet, not in Data Saver mode. No promised background activity after the app closes.
- Files undergo strict first-party URL, size, MIME and SHA-256 checks before they enter IndexedDB.
- When full, remove watched entries first, oldest watched/downloaded first; do not evict the currently playing file. Revoke removed/rights-changed items after a successful online catalogue update.
- IndexedDB Blob playback is fully device-local. User can remove individual files or clear the media pack. App shell, games, picture books and the existing text-only YouTube metadata catalogue are separate.
- PWA caching excludes owned video downloads so the same file is not duplicated in Cache Storage. No Supabase Storage is required.

The browser may evict storage under pressure; the 100 MB policy is application-side best effort based on estimated origin usage, not a guaranteed OS hard cap.
