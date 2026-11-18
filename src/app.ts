import { Hono } from 'hono'
import { clerkMiddleware } from '@hono/clerk-auth'
import { familyRoutes } from './routes/family'
import { videoRoutes } from './routes/videos'
import { channelRoutes } from './routes/channels'
import { screenTimeRoutes } from './routes/screentime'

const app = new Hono()
app.get('/api/health', (c) => c.json({ service: 'KidLite API', status: 'ok', phase: 1 }))
app.get('/api/config', (c) => c.json({ clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || null }))

// Auth is applied to all private route families; individual endpoints also check user identity.
app.use('/api/family/*', clerkMiddleware())
app.use('/api/videos/*', clerkMiddleware())
app.use('/api/channels/*', clerkMiddleware())
app.use('/api/screentime/*', clerkMiddleware())
app.route('/api/family', familyRoutes)
app.route('/api/videos', videoRoutes)
app.route('/api/channels', channelRoutes)
app.route('/api/screentime', screenTimeRoutes)
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((error, c) => {
  console.error('API error:', error.message)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
