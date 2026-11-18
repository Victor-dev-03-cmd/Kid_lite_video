// Dedicated Vercel function: safe to call before Clerk or Supabase is configured.
export function GET() {
  return Response.json(
    { service: 'KidLite API', status: 'ok', phase: 1 },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
