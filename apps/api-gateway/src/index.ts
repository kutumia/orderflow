import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

const ALLOWED_ORIGINS = (typeof process !== 'undefined' && process.env.CORS_ORIGINS)
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : []

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    if (ALLOWED_ORIGINS.length === 0) return '*'
    return ALLOWED_ORIGINS.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}))

async function requireApiKey(c: any, next: () => Promise<void>) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  const expected = typeof process !== 'undefined' ? process.env.API_GATEWAY_API_KEY : undefined
  if (!expected || apiKey === expected) {
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
  console.log('[Event Bus] Publishing order.created event to QStash', (body as { order_id?: string }).order_id)
  return c.json(
    { accepted: true, eventId: 'msg_' + Math.random().toString(36).substring(2, 11) },
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
