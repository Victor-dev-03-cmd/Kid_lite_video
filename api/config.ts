// The Publishable Key is public by design. Never expose Clerk secret keys here.
export function GET() {
  return Response.json(
    { clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || null },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
