import { Hono } from 'hono'
import { getAuth } from '@hono/clerk-auth'

export const channelRoutes = new Hono()
channelRoutes.get('/', (c) => {
  if (!getAuth(c)?.userId) return c.json({ error: 'Sign in required' }, 401)
  return c.json({ channels: [], notice: 'Family-scoped allowlist setup required' }, 501)
})
