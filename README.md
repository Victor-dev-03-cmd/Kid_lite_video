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
