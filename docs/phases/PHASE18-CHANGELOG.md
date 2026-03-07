# Phase 18: PrintBridge Cloud Extraction

**New files:** 14 | **Modified files:** 4

---

## Deployment

1. Run `supabase/migration-phase18.sql` in Supabase SQL Editor (creates pb_tenants, pb_usage_logs, pb_webhook_deliveries, increment_pb_usage function, internal tenant)
2. No new npm packages required
3. Deploy
4. Legacy print endpoints remain functional — agents will continue working without updates

---

## 18.1 — Internal SDK & Schema

| Feature | Description |
|---------|-------------|
| **pb_tenants table** | Multi-tenant registry: name, api_key_hash, api_key_prefix, webhook_url, monthly_limit, usage_count, usage_reset_at, plan (free/starter/pro), is_internal flag, restaurant_id link |
| **pb_usage_logs table** | Per-action logging: tenant_id, job_id, action (create_job, update_status, poll, heartbeat), metadata JSONB, timestamp |
| **pb_webhook_deliveries table** | Webhook delivery tracking: tenant_id, job_id, event, url, payload, status_code, attempt, status (pending/delivered/failed), next_retry_at |
| **Internal tenant** | Auto-created "OrderFlow Internal" tenant with unlimited jobs, no API key auth required |
| **increment_pb_usage RPC** | Atomic PL/pgSQL function to increment usage_count with automatic monthly reset |
| **PrintBridge SDK** | `src/lib/printbridge.ts` (280 lines) — complete abstraction layer: `createJob`, `pollJobs`, `updateJobStatus`, `getJob`, `getDevices`, `resolveTenant*`, `generateApiKey`, `hashApiKey`, `getMonthlyUsage`, `fireWebhook`, `retryPendingWebhooks` |
| **Webhook system** | Fires on terminal job states (printed/failed). 3 retries with exponential backoff (5s, 30s, 5min). Stored in pb_webhook_deliveries |

## 18.2 — Versioned API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pb/v1/poll` | GET | Agent fetches queued jobs (filtered by device_id) |
| `/api/pb/v1/poll` | POST | Agent reports job printed/failed |
| `/api/pb/v1/heartbeat` | GET | Connectivity check |
| `/api/pb/v1/heartbeat` | POST | Agent heartbeat with device info upsert |
| `/api/pb/v1/jobs` | POST | Create print job (receipt_data, device_id, priority) |
| `/api/pb/v1/jobs` | GET | List jobs (filter by status, limit) |
| `/api/pb/v1/jobs/[id]` | GET | Get single job by ID |
| `/api/pb/v1/devices` | GET | List connected printer devices |
| `/api/pb/v1/webhooks` | GET | List recent webhook deliveries |
| `/api/pb/v1/webhooks` | POST | Send test webhook |

**Auth:** All endpoints authenticate via `X-API-Key` header (also supports `?api_key=` query param for backwards compatibility).

**Rate limiting:** Enforced per-tenant. Free = 500/month, Starter = 5,000/month, Pro = unlimited. Returns 429 with `Retry-After` header when exceeded.

## 18.3 — Webhook Delivery

| Feature | Description |
|---------|-------------|
| **Auto-fire** | Webhooks fire automatically when job reaches printed or failed status |
| **Retry logic** | 3 attempts: 5s → 30s → 5min backoff. Stored in pb_webhook_deliveries with attempt count |
| **Test endpoint** | POST `/api/pb/v1/webhooks` sends test payload to configured webhook URL |
| **Delivery log** | GET `/api/pb/v1/webhooks` shows last 20 delivery attempts with status codes |
| **Retry cron** | `retryPendingWebhooks()` function processes pending deliveries (wire to cron/Vercel cron) |

## 18.4 — Documentation & Pages

| Feature | Description |
|---------|-------------|
| **API reference** | `/docs/printbridge` — full API documentation: quick start, auth, rate limits, all endpoints with request/response examples, webhooks, error codes |
| **PrintBridge landing** | `/printbridge` — product page: features, download agent, API docs link, how it works, free tier CTA |

## Code Migration

| File | Change |
|------|--------|
| **Stripe webhook** | Print job creation now uses `createJob()` SDK with `resolveTenantByRestaurant()`. Same multi-device routing logic preserved |
| **Legacy endpoints** | `/api/print-jobs/poll` and `/api/print-heartbeat` marked as DEPRECATED. Continue working for existing agents |

---

## New Files (14)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase18.sql` | 92 | Multi-tenant schema + RPC function |
| `src/lib/printbridge.ts` | 280 | PrintBridge SDK |
| `src/lib/pb-auth.ts` | 58 | API key auth middleware |
| `src/app/api/pb/v1/poll/route.ts` | 58 | Poll + report endpoints |
| `src/app/api/pb/v1/heartbeat/route.ts` | 82 | Heartbeat endpoints |
| `src/app/api/pb/v1/jobs/route.ts` | 80 | Create + list jobs |
| `src/app/api/pb/v1/jobs/[id]/route.ts` | 24 | Get job by ID |
| `src/app/api/pb/v1/devices/route.ts` | 33 | List devices |
| `src/app/api/pb/v1/webhooks/route.ts` | 82 | Webhook deliveries + test |
| `src/app/docs/printbridge/page.tsx` | 192 | API documentation page |
| `src/app/printbridge/page.tsx` | 115 | PrintBridge landing page |
| `PHASE18-CHANGELOG.md` | This file |

## Modified Files (4)

| File | Changes |
|------|---------|
| `src/app/api/webhooks/stripe/route.ts` | Migrated to PrintBridge SDK (createJob + resolveTenantByRestaurant) |
| `src/app/api/print-jobs/poll/route.ts` | Added DEPRECATED notice |
| `src/app/api/print-heartbeat/route.ts` | Added DEPRECATED notice |

---

## Exit Criteria

- [x] PrintBridge SDK abstracts all print operations
- [x] Webhook creates print jobs via SDK (not direct Supabase)
- [x] `/api/pb/v1/*` endpoints working with API key auth
- [x] Rate limiting per tenant (429 on exceeded)
- [x] Webhooks fire on job printed/failed with 3 retries
- [x] Test webhook endpoint working
- [x] Usage logging on every job create/update
- [x] API documentation published at /docs/printbridge
- [x] PrintBridge landing page with download + docs links
- [x] Legacy endpoints still functional (backwards compatible)
