# KidLite — Master Roadmap

## Vision
Kids-safe, low-bandwidth, parent-curated Progressive Web App for older iPads, low-cost Android phones and unreliable networks, built for Vercel. Kids can use a standalone offline story, memory game and original lullaby without fetching YouTube videos.

## Core stack
- Runtime/package manager: Bun
- Backend: Hono with Vercel serverless functions
- Identity: Clerk (Google/Email sign-in for parents)
- Data: Supabase PostgreSQL (families, child profiles, whitelisted channels, watch logs)
- Frontend: small vanilla JavaScript + CSS and mobile-first bento UI, revisit Mango only after confirming runtime compatibility
- Offline: service worker, PWA manifest and local games

## Security and parent curation
1. Verify Clerk JWTs on the server for every private API.
2. Provision the parent-owned family and child profile in Supabase.
3. Parent PIN: use a salted slow KDF (PBKDF2/Argon2) and rate limiting, not raw unsalted SHA-256.
4. Family-scoped, server-enforced channel allowlist for YouTube queries; never accept arbitrary channel IDs from a child client.
5. Validate content and parental approval; YouTube safeSearch=strict alone is not a safety guarantee.
6. Atomically enforce daily screen-time limits server-side and record watch activity.
7. Keep all secret keys in Vercel environment variables. Do not ship service role keys or YouTube API keys to the browser.

## UI
- Home cards: Rhymes, Stories, Science, Shorts
- Parent controls require verified parent authentication and PIN
- Player should be distraction-light, but related YouTube videos and playback quality cannot be fully suppressed/forced by embed URL parameters
- Offline activities: illustrated story reader, color match, original WebAudio melody
- Installable PWA: Android install prompt and iOS Add to Home Screen instructions

## Phases
### Phase 1 — Foundation
- Create package.json, TypeScript config, Hono API entrypoint and Vercel routing
- Public health/config routes, protected API stubs
- Supabase schema and RLS
- Responsive PWA shell and offline activity area
- .env.example, .gitignore and test suite
- Commit to GitHub

### Phase 2 — Functional authentication and content
- Complete Clerk sign-in and callback flow
- Auto-provision family and child profiles, profile editor
- Parent PIN set/verify, attempt throttling and session checks
- CRUD for family whitelisted channels
- Parent-curated, verified YouTube Data API retrieval and embedding
- Atomic screen-time tick and lockout
- Add integration/security tests and complete TypeScript compilation

### Phase 3 — Production readiness
- Mobile hardware and offline tests
- Vercel environment setup and deployment verification
- Rate-limits, logging without personal data, monitoring, quotas and error handling
- Accessibility, PWA install checks, child privacy audit and terms/compliance review

## Deploy
1. Connect repository to Vercel and choose the repo root.
2. Set CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY in Vercel.
3. Run Supabase SQL migration from supabase_schema.sql.
4. Check /api/health and site offline content.
5. Keep the app labelled a development preview until Phase 2 is complete.

This is the actionable roadmap for the starter. The original planning specification contained aspirational claims about forced 240p streaming and complete YouTube recommendation suppression that are not technically guaranteed.
