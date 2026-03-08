# Trust Boundary Map
**E2-T04 — System Trust Boundaries and Data Flow**
Last updated: 2026-03-08 | Status: Certified

---

## Trust Zones

```
┌─────────────────────────────────────────────────────────────────┐
│  ZONE 0 — PUBLIC INTERNET (Untrusted)                           │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐    │
│  │ Customer      │  │ Shopify       │  │ Stripe           │    │
│  │ Browser       │  │ Webhook       │  │ Webhook          │    │
│  └───────┬───────┘  └──────┬────────┘  └────────┬─────────┘    │
└──────────│─────────────────│──────────────────────│─────────────┘
           │ HTTPS            │ HMAC signed          │ HMAC signed
           ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ZONE 1 — EDGE / CDN (Vercel Edge Network)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Next.js Middleware (rate limit, CORS headers)            │  │
│  │  API Gateway (Cloudflare Worker) — /api/pb/v1 proxy       │  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────│──────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│  ZONE 2 — APPLICATION (Vercel Serverless Functions)              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Next.js API Routes (apps/web/src/app/api/**)           │    │
│  │  Authentication: NextAuth JWT + DB re-verification      │    │
│  │  Rate Limiting: Upstash Redis (sliding window)          │    │
│  │  Input Validation: Zod schemas on all mutation routes   │    │
│  └──────────────┬──────────────────────────────────────────┘    │
└─────────────────│────────────────────────────────────────────────┘
                  │ Service-role key (TLS)
┌─────────────────────────────────────────────────────────────────┐
│  ZONE 3 — DATA (Supabase / External Services)                   │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ Supabase         │  │ Stripe API   │  │ SendGrid       │    │
│  │ PostgreSQL + RLS │  │ Payments     │  │ Email delivery │    │
│  │ Storage (images) │  └──────────────┘  └────────────────┘    │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ZONE 4 — MACHINE (PrintBridge Agents)                          │
│  ┌────────────────────────┐                                     │
│  │ Electron App (Windows) │                                     │
│  │ API Key authentication │                                     │
│  │ Polls /api/pb/v1/poll  │                                     │
│  │ Sends heartbeat        │                                     │
│  └────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Boundary Crossings & Controls

### Zone 0 → Zone 1 (Public to Edge)

| Crossing | Control | Validation |
|----------|---------|-----------|
| Customer checkout | HTTPS + Zod schema | `checkoutSchema.safeParse()` |
| Shopify webhook | HMAC-SHA256 verification | `X-Shopify-Hmac-Sha256` header |
| Stripe webhook | HMAC-SHA256 verification | `stripe.webhooks.constructEvent()` |
| Public menu reads | Rate limit (general: 60/min) | No auth required |
| Auth attempts | Rate limit (login: 10/min) | NextAuth |

### Zone 0 → Zone 2 (Authenticated API)

| Crossing | Control | Validation |
|----------|---------|-----------|
| Dashboard API | JWT session + DB re-verification | `requireSession/Manager/Owner` |
| Admin API | JWT + platform_admin role check | Role === 'platform_admin' |
| PrintBridge API | SHA-256 hashed API key | Constant-time comparison |
| Cron jobs | Timing-safe secret comparison | `crypto.timingSafeEqual` |
| Internal service | `X-Internal-Secret` header | Constant-time comparison |

### Zone 2 → Zone 3 (App to Data)

| Crossing | Control | Validation |
|----------|---------|-----------|
| Supabase queries | Service-role key | TLS + application-layer tenant scoping |
| Stripe API | Secret key | TLS |
| SendGrid API | API key | TLS |

### Zone 4 → Zone 2 (Print Agent to API)

| Crossing | Control | Validation |
|----------|---------|-----------|
| Print job polling | Hashed API key | `X-API-Key` header → SHA-256 lookup |
| Device heartbeat | Hashed API key | Same |
| Job status update | Hashed API key | Same |

---

## Security Assertions at Each Boundary

### What We Trust
- Supabase for data integrity and RLS enforcement
- Stripe for payment card data handling (PCI DSS)
- Vercel for TLS termination and DDoS mitigation
- NextAuth for JWT issuance and signature verification

### What We Do NOT Trust
- JWT claims without DB re-verification (restaurant_id in JWT is validated against DB)
- Request IP headers without extracting first IP only
- Raw webhook payloads without HMAC verification
- API keys without SHA-256 hash lookup (raw keys never stored)
- Cron request secrets without timing-safe comparison
- User input without Zod validation

---

## Data Flow: Checkout Order (Critical Path)

```
Customer → POST /api/checkout
  → Rate limit check (Upstash Redis)
  → Zod schema validation (checkoutSchema)
  → Restaurant lookup (Supabase: is restaurant active?)
  → Menu item price lookup (Supabase: verify prices server-side)
  → Promo code validation (if present)
  → Stripe PaymentIntent creation (amount in pence)
  → Order record created (Supabase: status=pending)
  → Response: {clientSecret, orderId}

Customer → Stripe.js confirms payment
  → Stripe fires webhook: POST /api/webhooks/stripe
  → HMAC verification (Stripe signing secret)
  → Order status updated to 'paid' (Supabase)
  → Print job queued (pb_jobs)
  → Kitchen notified (real-time subscription)
```

> **Certification:** Trust boundaries reviewed 2026-03-08. No uncontrolled boundary crossings found.
