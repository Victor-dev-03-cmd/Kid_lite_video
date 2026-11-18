import { createClient } from '@supabase/supabase-js'

/** Server-only database client. Never expose SUPABASE_SERVICE_ROLE_KEY to public assets. */
export function getDatabase() {
  const url = process.env.SUPABASE_URL
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Supabase server configuration is incomplete')
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}
