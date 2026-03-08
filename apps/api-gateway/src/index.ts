import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Fail fast at startup if the API key is not configured.
// An unset key must not silently degrade to "allow all".
const API_GATEWAY_API_KEY = (typeof process !== 'undefined' && process.env.API_GATEWAY_API_KEY) || ''
if (!API_GATEWAY_API_KEY) {
  throw new Error('API_GATEWAY_API_KEY environment variable must be set')
}

const app = new Hono()

const ALLOWED_ORIGINS = (typeof process !== 'undefined' && process.env.CORS_ORIGINS)
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : []

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    // Default to restrictive — only allow listed origins.
    // Set CORS_ORIGINS env var to comma-separated list of allowed origins.
    if (ALLOWED_ORIGINS.length === 0) return null
    return ALLOWED_ORIGINS.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}))

async function requireApiKey(c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => Response }, next: () => Promise<void>) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  // Fail-closed: API_GATEWAY_API_KEY is guaranteed set above (startup check).
  if (apiKey === API_GATEWAY_API_KEY) {
    await next()
    return
  }
  return c.json({ error: 'Unauthorized' }, 401)
}

app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'orderflow-api-gateway' })
})

const v1 = new Hono()

v1.use('/orders', requireApiKey)
v1.post('/orders', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const orderId = (body as { order_id?: string }).order_id
  console.log('[Event Bus] Publishing order.created event to QStash', orderId)
  return c.json(
    { accepted: true, eventId: crypto.randomUUID() },
    202
  )
})

v1.use('/webhooks/qstash', requireApiKey)
v1.post('/webhooks/qstash', async (c) => {
  const eventPayload = await c.req.json().catch(() => ({}))
  console.log('[Event Bus Consumer] Processing event:', eventPayload)
  return c.json({ processed: true })
})

app.route('/v1', v1)

export default app
