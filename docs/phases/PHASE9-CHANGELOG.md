# Phase 9: Critical Fixes & Security Hardening — COMPLETE

**Version:** 0.9.0
**Files changed/created:** 26
**Tests:** 45+ test cases across 4 test files

---

## Deployment Order

1. `npm install` (new deps: @sentry/nextjs, @upstash/ratelimit, @upstash/redis, jest, testing-library)
2. Run `supabase/migration-phase9.sql` in Supabase SQL Editor
3. Enable Realtime on `orders` table: Supabase Dashboard → Database → Replication → Enable for `orders`
4. Add Stripe webhook events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Set env vars (optional for prod): `NEXT_PUBLIC_SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
6. Deploy

---

## All Bugs Fixed

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| BUG-001 | Modifier prices trusted from client | CRITICAL | Checkout fetches `item_modifiers` from DB, verifies every price |
| BUG-002 | All live features use polling | CRITICAL | KDS, order confirmation, dashboard kitchen use Supabase Realtime |
| BUG-003 | Subscription webhooks missing | CRITICAL | Added invoice.paid/failed, subscription.updated/deleted handlers |
| BUG-004 | stripe_payment_intent_id not unique | CRITICAL | UNIQUE constraint + atomic status check in webhook |
| BUG-005 | Order numbers global, not per-restaurant | CRITICAL | Per-restaurant trigger function |
| BUG-006 | Rate limiter in-memory (useless on Vercel) | CRITICAL | Upstash Redis with in-memory fallback |
| BUG-008 | Opening hours use UTC not restaurant TZ | CRITICAL | Timezone-aware check with restaurant.timezone |
| BUG-010 | KDS publicly accessible (no auth) | CRITICAL | PIN authentication with session storage |
| BUG-012 | Email templates HTML injection | HIGH | escapeHtml() on all interpolated values |
| BUG-014 | Trial expiry not enforced | CRITICAL | Middleware redirect + checkout block |
| BUG-015 | Orders API no pagination | HIGH | page/limit/from/to query params |
| BUG-017 | Reports full table scans | HIGH | Added composite indexes |
| BUG-018 | Receipt not stored at creation | HIGH | Stored at webhook time, poll uses stored data |
| BUG-019 | No email retry logic | HIGH | 1 retry with 1s delay on 5xx errors |
| BUG-020 | Promo code increment race condition | CRITICAL | Atomic SQL function `increment_promo_usage()` |
| BUG-021 | No input length validation | HIGH | Max lengths on all fields, sanitization |
| BUG-024 | No admin audit log | MEDIUM | `admin_audit_log` table created |
| BUG-026 | No structured logging | MEDIUM | JSON logger with levels |

## Features Added

| # | Feature | Description |
|---|---------|-------------|
| FEAT-007 | Password reset | Complete forgot → email → reset flow |
| FEAT-017 | Sentry error monitoring | Client, server, edge configs + next.config.js integration |
| — | Test suite | Jest + 45 tests covering utils, validation, checkout logic, webhooks, auth |

---

## File Manifest (26 files)

### New Files (14)
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/logger.ts` | 50 | Structured JSON logging |
| `src/lib/validation.ts` | 123 | Input validation, escapeHtml, sanitization |
| `src/app/api/auth/forgot-password/route.ts` | 89 | Generate reset token, send email |
| `src/app/api/auth/reset-password/route.ts` | 75 | Validate token, set new password |
| `src/app/api/kitchen/auth/route.ts` | 39 | Kitchen PIN validation |
| `src/app/forgot-password/page.tsx` | 116 | "Enter your email" UI |
| `src/app/reset-password/page.tsx` | 161 | "Set new password" UI |
| `sentry.client.config.ts` | 18 | Sentry client init |
| `sentry.server.config.ts` | 16 | Sentry server init |
| `sentry.edge.config.ts` | 7 | Sentry edge init |
| `jest.config.js` | 20 | Jest configuration |
| `src/__tests__/utils.test.ts` | 218 | Utils + validation tests |
| `src/__tests__/checkout.test.ts` | 195 | Checkout logic + modifier verification tests |
| `src/__tests__/webhook.test.ts` | 87 | Webhook lifecycle tests |
| `src/__tests__/auth.test.ts` | 117 | Auth flow + password reset tests |
| `supabase/migration-phase9.sql` | 142 | All schema changes |

### Modified Files (12)
| File | Changes |
|------|---------|
| `src/app/api/checkout/route.ts` | REWRITTEN — modifier verification, timezone, trial, validation |
| `src/app/api/webhooks/stripe/route.ts` | REWRITTEN — subscription lifecycle, atomic promo, receipt storage |
| `src/app/api/orders/route.ts` | Added pagination |
| `src/app/api/print-jobs/poll/route.ts` | Uses stored receipt_data |
| `src/app/kitchen/[slug]/page.tsx` | REWRITTEN — Supabase Realtime + PIN auth |
| `src/app/[slug]/order/[id]/page.tsx` | REWRITTEN — Supabase Realtime |
| `src/app/dashboard/kitchen/page.tsx` | REWRITTEN — Supabase Realtime |
| `src/lib/email.ts` | escapeHtml + retry logic |
| `src/lib/rate-limit.ts` | REWRITTEN — Upstash + fallback |
| `src/lib/auth.ts` | trial_ends_at + subscription_status in JWT |
| `src/app/login/page.tsx` | Added "Forgot password?" link |
| `middleware.ts` | REWRITTEN — trial enforcement + cancelled redirect |
| `src/app/api/register/route.ts` | Stores trial_ends_at |
| `next.config.js` | Sentry integration |
| `package.json` | New deps + test scripts |
