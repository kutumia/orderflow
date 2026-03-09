# Dependency Audit — E7-T01
**Critical Dependency Assessment and Failure Mode Analysis**
Last updated: 2026-03-08 | Status: Certified

---

## Methodology

Each dependency is classified by:
- **Criticality:** CRITICAL (service fails without it) / IMPORTANT (degraded) / NON-CRITICAL (no impact)
- **Failure mode:** What happens when this dependency is unavailable
- **Mitigation:** Current fallback or recovery mechanism

---

## Tier 1: CRITICAL Dependencies

Service is completely unavailable without these.

### 1.1 Supabase PostgreSQL

| Property | Value |
|----------|-------|
| Dependency type | Database (persistence layer) |
| Impact of failure | All API routes return 500; no orders can be placed or viewed |
| SLA | Supabase Pro: 99.9% uptime |
| Single point of failure? | Yes — no read replica in current config |
| Failure detection | Health check (`/api/health`) returns 503 within 30s |
| Recovery | Automatic (Supabase manages DB infra); RTO: 2 hours for full restoration |
| Known limitation | L-001: Single-region (EU-West-1); see `docs/certification/known-limitations.md` |

**Mitigation:** Daily backups with point-in-time recovery (1-hour RPO). See `docs/ops/backup-restore.md`.

---

### 1.2 Vercel (Next.js hosting)

| Property | Value |
|----------|-------|
| Dependency type | Application runtime + CDN |
| Impact of failure | Customer-facing app and all API routes unavailable |
| SLA | Vercel Enterprise: 99.99% uptime |
| Failure detection | External uptime monitor (e.g., Better Uptime) |
| Recovery | Automatic (Vercel manages infra); rollback to previous deployment in < 5 minutes |

---

### 1.3 Stripe

| Property | Value |
|----------|-------|
| Dependency type | Payment processing |
| Impact of failure | New checkouts fail; existing paid orders unaffected |
| SLA | Stripe: 99.99% uptime |
| Failure mode | `stripe.paymentIntents.create()` throws; 500 returned to customer |
| Failure detection | Error rate alert on `/api/checkout` (threshold: > 5% over 2 min) |
| Recovery | Automatic when Stripe recovers; no manual intervention |

---

## Tier 2: IMPORTANT Dependencies

Service degrades significantly but does not fully fail.

### 2.1 Upstash Redis (Rate Limiting)

| Property | Value |
|----------|-------|
| Dependency type | Distributed rate limiting |
| Impact of failure | Rate limits become per-instance (not global) |
| Failure mode | `checkRateLimit()` catches exception → falls back to in-memory `Map` |
| Failure detection | Warning log: `"rate-limit: Upstash unavailable"` |
| Recovery | Automatic reconnect when Upstash recovers |

**Mitigation:** In-memory fallback ensures no service disruption. Global rate limiting effectiveness temporarily reduced. See Known Limitation L-002.

---

### 2.2 Cloudflare Workers (API Gateway)

| Property | Value |
|----------|-------|
| Dependency type | API gateway, routing, bot protection |
| Impact of failure | Direct traffic to Vercel possible (bypass gateway); no auth bypass (auth is in app layer) |
| Failure mode | Gateway routes stop responding; clients get connection errors |
| Recovery | Vercel URL accessible directly; DNS failover possible |

---

### 2.3 PrintBridge Agent (Electron)

| Property | Value |
|----------|-------|
| Dependency type | Thermal printer bridge (per-restaurant) |
| Impact of failure | Print jobs queue; restaurants must use digital display only |
| Failure mode | Agent offline → jobs accumulate in `pb_jobs` with `status = queued` |
| Failure detection | `last_seen_at > 5 min` → dashboard shows offline; alert fires |
| Recovery | Agent restart → automatically picks up queued jobs |

---

## Tier 3: NON-CRITICAL Dependencies

Service continues normally without these.

### 3.1 Shopify Integration

| Property | Value |
|----------|-------|
| Dependency type | Optional third-party integration |
| Impact of failure | Shopify orders not imported; core OrderFlow functionality unaffected |
| Failure mode | Shopify webhooks fail; sync paused |
| Recovery | Resync when integration restored |

---

### 3.2 Email Service (SMTP/Transactional)

| Property | Value |
|----------|-------|
| Dependency type | Transactional email (loyalty, receipts) |
| Impact of failure | Emails not sent; orders still processed |
| Failure mode | Email calls fail silently; no impact on checkout flow |
| Recovery | Retry cron picks up unsent emails |

---

## Dependency Risk Matrix

| Dependency | Failure Probability | Business Impact | Risk Score | Mitigation Status |
|------------|--------------------|-----------------|-----------|--------------------|
| Supabase DB | Low (99.9% SLA) | Critical | High | Daily backups; 2hr RTO |
| Vercel | Very Low (99.99%) | Critical | Medium | Sub-5min rollback |
| Stripe | Very Low (99.99%) | High | Medium | Automatic recovery |
| Upstash Redis | Low | Medium | Low-Medium | In-memory fallback |
| CF Workers | Low | Medium | Low-Medium | Direct Vercel fallback |
| PrintBridge Agent | Medium (software) | Medium (per tenant) | Medium | Job queue persistence |

---

## npm Dependency Health

Last audited: 2026-03-08 (via CI `npm audit`):

```
found 0 vulnerabilities
```

Key production dependencies:

| Package | Version | License | Security Status |
|---------|---------|---------|----------------|
| `next` | 14.x | MIT | ✅ |
| `@supabase/supabase-js` | 2.x | MIT | ✅ |
| `stripe` | 14.x | MIT | ✅ |
| `zod` | 3.x | MIT | ✅ |
| `@upstash/redis` | 1.x | MIT | ✅ |
| `next-auth` | 4.x | ISC | ✅ |
| `hono` | 3.x | MIT | ✅ |
| `electron` | 28.x | MIT | ✅ |

**License policy:** All production dependencies use MIT, ISC, or Apache-2.0. No GPL or AGPL in production paths.

---

## Quarterly Review Checklist

- [ ] Run `npm audit` across all packages
- [ ] Review Dependabot alerts
- [ ] Check SLA changes for Supabase, Vercel, Stripe
- [ ] Update this document with any new dependencies added
- [ ] Verify fallback mechanisms still functional (mini chaos drill)

---

> **Certification:** Dependency audit completed 2026-03-08. Evidence for E7-T01.
