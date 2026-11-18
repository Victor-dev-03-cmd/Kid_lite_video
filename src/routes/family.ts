import { Hono } from 'hono'
import { getAuth } from '@hono/clerk-auth'
import { getDatabase } from '../services/supabase.js'

export const familyRoutes = new Hono()

familyRoutes.get('/me', async (c) => {
  const auth = getAuth(c)
  if (!auth?.userId) return c.json({ error: 'Sign in required' }, 401)
  try {
    const db = getDatabase()
    const { data, error } = await db.from('families').select('id, email, subscription_status, created_at').eq('clerk_user_id', auth.userId).maybeSingle()
    if (error) throw error
    // Provisioning and email verification are explicitly deferred to Phase 2.
    return c.json({ family: data, setupRequired: !data })
  } catch {
    return c.json({ error: 'Database not configured; see README' }, 503)
  }
})
