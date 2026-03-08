# Order Lifecycle & Workflow Integrity
**E3-T01 / E3-T04 — Workflow Diagrams and Job Lifecycle**
Last updated: 2026-03-08 | Status: Certified

---

## Order State Machine

```
                    ┌─────────┐
                    │ CREATED │  ← Customer submits checkout
                    └────┬────┘
                         │ Stripe PaymentIntent created
                         ▼
                    ┌─────────┐
                    │ PENDING │  ← Awaiting payment confirmation
                    └────┬────┘
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
         ┌────────┐          ┌──────────┐
         │  PAID  │          │  FAILED  │  ← Payment declined
         └────┬───┘          └──────────┘
              │ Stripe webhook confirms
              │ Print job queued
              ▼
         ┌──────────────┐
         │  CONFIRMED   │  ← Kitchen receives order
         └──────┬───────┘
                │ Kitchen accepts
                ▼
         ┌─────────────────┐
         │  PREPARING      │  ← Kitchen working on order
         └──────┬──────────┘
                │ Ready for collection/dispatch
                ▼
         ┌─────────────────┐
         │  READY          │  ← Awaiting customer/driver
         └──────┬──────────┘
                │
       ┌────────┴────────┐
       ▼                  ▼
  ┌──────────┐      ┌──────────────┐
  │ COLLECTED│      │  DISPATCHED  │  ← Delivery sent out
  └──────────┘      └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  DELIVERED   │
                    └──────────────┘

Refund path (from PAID / CONFIRMED / PREPARING):
  → REFUNDED (Stripe refund issued; owner-only action)
```

---

## Print Job State Machine

```
         ┌────────┐
         │ QUEUED │  ← Order confirmed → print job created
         └───┬────┘
             │ Agent polls /api/pb/v1/poll
             ▼
         ┌──────────┐
         │ PRINTING │  ← Agent locks job; sends to printer
         └───┬──────┘
    ┌────────┴────────┐
    ▼                  ▼
┌─────────┐      ┌────────┐
│ PRINTED │      │ FAILED │  ← Printer error; retry eligible
└─────────┘      └───┬────┘
                     │ attempts < 3
                     └──────────→ Re-queued after 60s backoff
                       attempts ≥ 3 → Dead letter (alert fired)
```

---

## Idempotency Model

### Checkout (POST /api/checkout)

**Client responsibility:** Generate a `Idempotency-Key` UUID before submission.
If payment flow fails, retry with the same key.

**Server behaviour:**
1. Hash `Idempotency-Key` + `restaurant_id` as cache scope
2. Check `idempotency_keys` table for existing response
3. If found (< 24hr TTL): return cached response
4. If not found: execute checkout → store response → return

**Guarantees:**
- Customer is never charged twice for the same key
- Same PaymentIntent is returned on retry
- Stripe deduplicates via `idempotency_key` parameter natively

### Refund (POST /api/orders/refund)

**Client:** Send `Idempotency-Key` on refund request.

**Server:**
- Check Stripe: if refund already exists for this PaymentIntent → return existing
- Store refund ID to prevent second Stripe API call
- Stripe enforces refund idempotency by PaymentIntent ID

### Shopify Order Sync (POST /api/shopify/orders)

**Deduplication:** Shopify sends `X-Shopify-Webhook-Id` header.
Server checks `shopify_order_id` in orders table before creating.
`INSERT ... ON CONFLICT (shopify_order_id) DO NOTHING` prevents duplicates.

### Cron Jobs

**Engagement emails:** Dedup by `(customer_id, template_id, week_of_year)` — never send same template twice in same week.

**Print queue processor:** Atomic status transition `queued → printing` prevents double-dispatch.

---

## Correlation ID Flow

Every API request carries a `X-Correlation-ID` header. This ID:

1. **Inbound**: Extracted from request or generated as UUID v4
2. **Logging**: Included in every structured log event (`{ correlationId }`)
3. **Outbound**: Returned in response headers
4. **Cross-service**: Forwarded to Supabase RPC calls as `app.current_request_id` where supported
5. **Print jobs**: Stored as `correlation_id` field for end-to-end tracing

**Trace reconstruction:** Filter Vercel logs by `correlationId` to see the complete request chain.

---

## Replay & Retry Design

### Print Job Retry
- Max 3 attempts with exponential backoff (60s, 120s, 240s)
- Agent detects `status=failed` with `attempts < 3` → re-queues
- Dead letter: `attempts >= 3` → status remains `failed`, alert fired

### Cron Job Retry
- Vercel Cron: runs every N minutes by schedule
- If cron crashes, next scheduled run picks up where left off
- Idempotent design: re-processing already-sent emails is prevented by sent_emails table

### Webhook Retry (External)
- Shopify: retries for 48 hours with exponential backoff
- Stripe: retries for 72 hours
- Server returns 200 on duplicate webhook to stop retry storm
- Deduplication at DB layer prevents double-processing

---

## Duplicate Event Tests

See `apps/web/src/__tests__/idempotency.test.ts` for coverage of:
- Duplicate checkout returns cached PaymentIntent
- Duplicate Shopify order webhook is silently ignored
- Duplicate Stripe webhook is silently ignored
- Print job double-dispatch prevention
