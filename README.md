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
