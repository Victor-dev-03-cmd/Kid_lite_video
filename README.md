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
