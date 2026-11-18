import { Hono } from 'hono'
import { getAuth } from '@hono/clerk-auth'
import { youtubeSearchUrl } from '../services/youtube'

export const videoRoutes = new Hono()
videoRoutes.get('/', (c) => {
  if (!getAuth(c)?.userId) return c.json({ error: 'Sign in required' }, 401)
  // Intentionally avoid exposing a public channelId-to-YouTube proxy: only DB-backed allowlisted channels are safe.
  return c.json({ videos: [], notice: 'Whitelist-backed YouTube retrieval is scheduled for Phase 2' }, 501)
})
// Exported for Phase 2; URL builder validates channel IDs and enables strict SafeSearch.
export { youtubeSearchUrl }
