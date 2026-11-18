import { Hono } from 'hono'
import { getAuth } from '@hono/clerk-auth'

export const screenTimeRoutes = new Hono()
screenTimeRoutes.post('/tick', (c) => {
  if (!getAuth(c)?.userId) return c.json({ error: 'Sign in required' }, 401)
  // No fake watch-minute increments. Atomic database tick + rate limiting are Phase 2.
  return c.json({ error: 'Screen-time tracking is not yet enabled' }, 501)
})
