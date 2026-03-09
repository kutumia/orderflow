# Integration Trust Boundaries — E2-T04
**Third-Party Integration Security Controls**
Last updated: 2026-03-08 | Status: Certified

---

## Overview

This document defines the trust model for each external integration: what data crosses the boundary, how it is verified, and what the blast radius is if the integration is compromised.

See also: `docs/security/trust-boundary-map.md` for the overall zone diagram.

---

## Integration 1: Stripe

### Trust Level: High (PCI-scoped partner)

| Property | Value |
|----------|-------|
| Direction | Inbound (webhooks) + Outbound (API calls) |
| Authentication inbound | HMAC-SHA256 signature (`Stripe-Signature` header) |
| Authentication outbound | Bearer API key (`STRIPE_SECRET_KEY`) |
| Data shared | PaymentIntent amounts, metadata (orderId, restaurantId) |
| PII shared | None — Stripe handles card data; OrderFlow never receives card numbers |
| Key storage | Vercel environment variable (never in code) |
| Webhook endpoint | `/api/webhooks/stripe` |

### Controls

**Inbound (Stripe → OrderFlow):**
- Every webhook: `stripe.webhooks.constructEvent(body, sig, webhookSecret)` — rejects invalid signatures
- Audit log: `webhook.hmac_invalid` on failure
- Idempotency: `stripe_event_id` stored; duplicate events return 200 without reprocessing
- Late webhooks: processed correctly regardless of delay (no timestamp expiry)

**Outbound (OrderFlow → Stripe):**
- API key scoped to PaymentIntents only (Restricted Key — no refunds via API, unless explicitly scoped)
- All Stripe API calls wrapped in `try/catch (err: unknown)`
- Error messages sanitised before returning to customer

### Compromise Blast Radius

| Scenario | Impact | Recovery |
|----------|--------|----------|
| `STRIPE_SECRET_KEY` leaked | Attacker can create/cancel PaymentIntents | Rotate key; review Stripe logs |
| `STRIPE_WEBHOOK_SECRET` leaked | Attacker can forge webhook events | Rotate secret; re-register endpoint |
| Stripe account compromised | Financial fraud risk | Contact Stripe immediately; freeze account |

---

## Integration 2: Shopify

### Trust Level: Medium (OAuth, tenant-scoped)

| Property | Value |
|----------|-------|
| Direction | Inbound (webhooks + OAuth callback) + Outbound (Admin API) |
| Authentication inbound | HMAC-SHA256 (`X-Shopify-Hmac-Sha256`) |
| Authentication outbound | OAuth access token per shop |
| Data shared | Product data, order data (line items, totals) |
| PII shared | Customer name, email, shipping address (for Shopify orders only) |
| Key storage | `shopify_settings` table (access token encrypted at rest by Supabase) |
| OAuth nonce | 15-minute TTL, single-use, DB-backed |

### Controls

**OAuth flow:**
- State parameter (`nonce`) generated with `crypto.randomUUID()`
- Nonce stored in DB with `created_at` timestamp
- On callback: nonce must match AND be < 15 minutes old
- Nonce deleted after single use

**Inbound webhooks:**
- HMAC verification on every event
- Restaurant scoped: webhook events only processed for the registered shop

**Outbound:**
- Access token per tenant — compromise of one tenant's token does not affect others
- Token scope: read_products, read_orders (minimum required)

### Compromise Blast Radius

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Shopify access token leaked | Attacker can read that restaurant's Shopify data | Run `disable-integration.ts --integration shopify`; re-auth |
| OAuth nonce replay attack | None — nonces have 15-min TTL and are single-use | N/A (mitigated) |
| Shopify webhook secret leaked | Forged webhooks could inject fake orders | Rotate webhook secret in Shopify admin |

---

## Integration 3: PrintBridge

### Trust Level: High (internal SaaS, API key auth)

| Property | Value |
|----------|-------|
| Direction | Inbound (agent → API) |
| Authentication | SHA-256-hashed API key (`X-API-Key` header) |
| Data shared | Print job content (receipt text, order data) |
| PII shared | Customer name, order items (receipt content) |
| Key storage | `pb_api_keys` table — SHA-256 hash only (raw key shown once at creation) |
| Tenant isolation | Every API key is scoped to one `tenant_id`; enforced at DB level |

### Controls

**API key validation:**
- Raw key never stored — SHA-256 hash compared using timing-safe comparison
- Key lookup: `WHERE key_hash = sha256(provided_key) AND tenant_id = :tenant`
- Tenant ID cannot be overridden by the API key holder

**Webhook signing (outbound):**
- PrintBridge fires webhooks to restaurant's callback URL
- Signed with `X-PrintBridge-Signature: sha256=<hmac>` using tenant's `webhook_secret`
- Recipients can verify authenticity

**Job isolation:**
- `getJob(jobId, tenantId)` always applies `.eq("tenant_id", tenantId)` — tenant cannot access another tenant's jobs

### Compromise Blast Radius

| Scenario | Impact | Recovery |
|----------|--------|----------|
| API key leaked | Attacker can read/create print jobs for that tenant only | Revoke key; issue new key via dashboard |
| PrintBridge webhook secret leaked | Forged print callbacks could update job status | Rotate via `pb_tenants.webhook_secret` |
| Agent binary compromised | Print content could be intercepted | Revoke API key; re-install agent |

---

## Integration 4: Upstash Redis

### Trust Level: Medium (infrastructure, rate limiting only)

| Property | Value |
|----------|-------|
| Direction | Outbound (OrderFlow → Upstash) |
| Authentication | REST token (`UPSTASH_REDIS_REST_TOKEN`) |
| Data shared | Rate limit counters keyed by IP (no PII) |
| PII shared | None |
| Failure mode | Falls back to in-memory rate limiter (graceful degradation) |

### Controls
- No PII stored in Redis (keys are IP hashes + route identifiers)
- Token scoped to read/write on rate-limit namespace only
- Fallback: in-memory store if Redis unavailable (no service disruption)

### Compromise Blast Radius

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Redis token leaked | Attacker can read/write rate limit counters; could bypass rate limits | Rotate token; monitor for abuse |
| Redis unavailable | Rate limits become per-instance (known limitation L-002) | Automatic fallback |

---

## Integration 5: Vercel (Deployment Platform)

### Trust Level: Infrastructure

| Property | Value |
|----------|-------|
| Auth | Vercel account + GitHub Actions token |
| Data shared | Source code, environment variables, logs |
| PII risk | Logs may contain correlation IDs (no PII by logging standard) |

### Controls
- All secrets stored as Vercel environment variables (never in code)
- `.env.example` documents required variables (no actual values)
- Log drain configured to route to secure external service
- Branch protection: staging only deploys from `staging` branch; production from `main`

---

## Cross-Integration Risk Matrix

| Integration | Confidentiality Risk | Integrity Risk | Availability Risk | Overall |
|-------------|---------------------|----------------|------------------|---------|
| Stripe | Low (no PII) | Medium (forged webhooks) | High (checkout blocked) | Medium |
| Shopify | Medium (customer PII) | Low (order dedup) | Low (async) | Medium |
| PrintBridge | Low (receipt data) | Low (job isolation) | Medium (print fails) | Low-Medium |
| Upstash Redis | Low (no PII) | Low | Low (fallback) | Low |

---

> **Certification:** Integration trust boundaries verified 2026-03-08. Evidence for E2-T04.
