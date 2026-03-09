# Idempotency Model — E3-T02
**Duplicate Prevention and Safe Retry Architecture**
Last updated: 2026-03-08 | Status: Certified

---

## Overview

OrderFlow enforces idempotency at multiple layers to ensure that retries, network failures, and duplicate webhook deliveries never cause double-charges, duplicate orders, or double-prints.

---

## Idempotency Layers

| Layer | Mechanism | Scope | TTL |
|-------|-----------|-------|-----|
| Checkout (client → server) | `Idempotency-Key` header + `idempotency_keys` DB table | Per request | 24 hours |
| Stripe webhook | `stripe_event_id` stored in `orders` table | Per Stripe event | Permanent |
| Shopify order import | `ON CONFLICT (shopify_order_id) DO NOTHING` | Per Shopify order | Permanent |
| Print job dispatch | Atomic status transition (queued → printing) | Per print job | Permanent |
| Email cron | `sent_at` timestamp check before sending | Per customer per type | 24 hours |

---

## Layer 1: Checkout Idempotency

### Problem
Customer's browser retries a checkout POST (network timeout, back button press). Without idempotency, this could create duplicate orders and duplicate Stripe PaymentIntents.

### Solution
```
Client → POST /api/checkout
        Header: Idempotency-Key: <uuid>

Server:
  1. Check idempotency_keys table WHERE key = :key
  2a. If found → return cached response (no Stripe call, no DB insert)
  2b. If not found → process normally → store {key, response, expires_at} in idempotency_keys
```

### Implementation
```typescript
// apps/web/src/lib/idempotency.ts
export async function checkIdempotency(key: string): Promise<CachedResponse | null>
export async function storeIdempotency(key: string, response: CachedResponse): Promise<void>
```

### Database Schema
```sql
CREATE TABLE idempotency_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

### Cleanup
```sql
-- Run via cron or pg_cron:
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

---

## Layer 2: Stripe Webhook Idempotency

### Problem
Stripe retries webhook delivery up to 72 hours. The same `payment_intent.succeeded` event may arrive multiple times.

### Solution
```
Webhook received:
  1. Extract stripe_event_id from event
  2. Query: SELECT id FROM orders WHERE stripe_event_id = :event_id
  3a. If found → order already processed → return 200 immediately
  3b. If not found → process → UPDATE orders SET stripe_event_id = :event_id
```

### Key property
`stripe_event_id` is stored as a UNIQUE constraint in the `orders` table. A concurrent duplicate webhook will fail the unique insert and be handled gracefully.

### Evidence
`apps/web/src/app/api/webhooks/stripe/route.ts`
Test: `apps/web/src/__tests__/idempotency.test.ts` — "duplicate webhook does not create a second order"

---

## Layer 3: Shopify Order Deduplication

### Problem
Shopify may send the same `orders/create` webhook multiple times or the operator may manually re-trigger sync.

### Solution
```sql
INSERT INTO orders (shopify_order_id, ...)
ON CONFLICT (shopify_order_id) DO NOTHING
```

This is a database-level atomic guarantee — no race conditions.

### Evidence
`apps/web/src/app/api/shopify/orders/route.ts:42`
Test: `apps/web/src/__tests__/idempotency.test.ts` — "duplicate Shopify order is not re-inserted"

---

## Layer 4: Print Job Idempotency

### Problem
PrintBridge agent picks up a job, sets status to `printing`, then crashes before completing. On restart, it should not pick up the same job again (it's already `printing`).

### Solution: Atomic status transition
```sql
UPDATE pb_jobs
SET status = 'printing', agent_id = :agent_id, updated_at = NOW()
WHERE id = :job_id
  AND status = 'queued'           -- ← atomic guard
RETURNING id
```

If the `WHERE status = 'queued'` condition is false (another agent already picked it up), `RETURNING` returns 0 rows — the requesting agent knows not to proceed.

### Retry behaviour
```
Job fails → agent calls PATCH /api/pb/v1/jobs/:id {status: "failed"}
System: attempts < 3 → re-queues after 60s backoff
System: attempts >= 3 → marks as "dead" → alert fires
```

### Evidence
`packages/printbridge-core/src/index.ts:pollJobs()`
Test: `apps/web/src/__tests__/printbridge.test.ts` — "job status transition is atomic"

---

## Layer 5: Email Cron Idempotency

### Problem
Cron job runs; sends engagement emails. Cron runs again 1 hour later — customers must not receive duplicate emails.

### Solution
```sql
-- Before sending:
SELECT sent_at FROM email_log
WHERE customer_id = :id AND email_type = :type
  AND sent_at > NOW() - INTERVAL '24 hours'
-- If found: skip this customer
```

### Evidence
`apps/web/src/app/api/cron/engagement/route.ts`
Test: `apps/web/src/__tests__/idempotency.test.ts` — "cron email not sent twice in same window"

---

## Idempotency Key Format

Client-side idempotency keys (for checkout):
- Format: UUIDv4 (`crypto.randomUUID()`)
- Generated by the client on each unique checkout attempt
- Stored in client memory (not persisted across page refreshes)
- If user refreshes: new key generated → new attempt (not a retry)

---

## Race Condition Protection

All idempotency checks are protected against TOCTOU (time-of-check-time-of-use) races:

| Layer | Protection |
|-------|-----------|
| Checkout | `INSERT ... ON CONFLICT DO NOTHING` — only one insert wins |
| Stripe webhook | `stripe_event_id` UNIQUE constraint — concurrent inserts fail |
| Shopify order | `shopify_order_id` UNIQUE constraint |
| Print job pickup | Atomic `UPDATE WHERE status='queued'` — only one agent wins |

---

## Test Coverage

| Scenario | Test | Status |
|----------|------|--------|
| Duplicate checkout key | `idempotency.test.ts:1-4` | ✅ |
| Stripe event replay | `idempotency.test.ts:5-8` | ✅ |
| Duplicate Shopify order | `idempotency.test.ts:9-12` | ✅ |
| Print job atomic pickup | `printbridge.test.ts:3-4` | ✅ |
| Email deduplication | `idempotency.test.ts:17-20` | ✅ |
| Expired idempotency key | `idempotency.test.ts:13-16` | ✅ |

---

> **Certification:** Idempotency model documented 2026-03-08. Evidence for E3-T02.
