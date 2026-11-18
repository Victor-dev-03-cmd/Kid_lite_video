# KidLite — Offline Media Architecture (proposed next phase)

## Separation of media and metadata
Supabase PostgreSQL should hold lightweight YouTube video identifiers, links, channel keys, titles, duration, approval and refreshed-at timestamps. Saving the links alone does NOT provide offline playback.

YouTube API Services Developer Policies prohibit downloading, caching, storing and enabling offline playback of YouTube audiovisual content without YouTube's prior written approval. Do not download such files to Supabase Storage, IndexedDB or Cache Storage. Only videos the project owns or has explicit offline distribution rights to may be offered as downloadable offline assets.

## Recommended design
1. Server refresh job ingests only approved YouTube channel IDs, validates video metadata and embed availability, deduplicates video IDs, and applies parental moderation and age suitability review.
2. Supabase table video_catalog stores metadata (source, video_id, channel_key, kind, age suggestions, published_at, checked_at, approval status) with indexes. Add parent-scoped channel approvals with Row Level Security. Do not expose service role keys to clients.
3. Device IndexedDB can store a limited metadata snapshot for an offline CATALOGUE; that catalogue cannot play YouTube videos without internet. Refresh or delete cached YouTube API metadata within policy limits, commonly 30 days, and honor deletions/availability changes.
4. Separate private Supabase Storage bucket for owned/authorized offline original files. Signed access, user-consented downloads, integrity checks, quota estimator, LRU eviction and a delete-downloads setting.
5. For 2–12 year olds, complete parent authentication, PIN enforcement, child-directed YouTube client designation and a privacy/compliance assessment before public launch.

## 1 GB budget example
At an illustrative combined video/audio rate of 200 kbps, 100 ten-minute videos take about 1,500 MB and 1,000 thirty-second clips about 750 MB: total 2,250 MB, above 1 GB. At 1 KB average per metadata record, 1,100 IDs and titles are around 1.1 MB before database overhead. Supabase Free file-storage quota and PostgreSQL database quota are separate.

## Future engineering deliverables
- SQL migration for catalog and approval tables, family-scoped policies, ingestion refresh and deactivation of removed/expired videos.
- Offline catalogue in IndexedDB and corresponding UI distinctions between offline-ready original media and internet-required YouTube videos.
- Authorized original media packs, download queue with storage budget and eviction, device testing.
- Robust security and children-data compliance review.

Status: design only. No new Supabase schema or media files were deployed in this performance phase.