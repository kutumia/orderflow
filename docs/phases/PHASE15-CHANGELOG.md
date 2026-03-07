# Phase 15: Launch-Ready Product Polish

**New files:** 11 | **Modified files:** 9

---

## Deployment

1. Run `supabase/migration-phase15.sql` in Supabase SQL Editor
2. `npm install` (new: web-push, posthog-js)
3. Set env vars:
   - `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_ANNUAL` (create in Stripe dashboard)
   - `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_ANNUAL`
   - `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`
   - `UNSUBSCRIBE_SECRET` (any random string, or uses NEXTAUTH_SECRET as fallback)
   - `NEXT_PUBLIC_POSTHOG_KEY` (from PostHog dashboard)
   - `NEXT_PUBLIC_POSTHOG_HOST` (default: https://eu.posthog.com)
4. Deploy

---

## 15.1 — Pricing Tiers & Feature Gating

| Feature | Description |
|---------|-------------|
| **3-tier pricing** | Starter (£49), Growth (£89), Pro (£149). Monthly or annual (2 months free). Plan stored on `restaurants.plan` |
| **Feature gating lib** | `src/lib/feature-gates.ts` — `hasFeature(plan, feature)`, `requiredPlan(feature)`, `GATED_PATHS`, `PLANS` config with prices and feature lists |
| **Middleware gating** | Dashboard paths checked against plan. Loyalty/marketing/QR code require Growth+. Redirects to billing page with upgrade prompt |
| **Billing page** | REWRITTEN — 3 pricing cards with current plan badge, upgrade/downgrade with Stripe proration, annual toggle, setup fee payment |
| **Subscription API** | REWRITTEN — GET (status), POST (new subscription or setup fee), PUT (plan change with proration). Supports ad-hoc prices if Stripe Price IDs not configured |
| **Setup fee** | £149 one-time charge via Stripe Checkout. Tracked as `setup_fee_paid` on restaurant |
| **Auth integration** | Plan included in JWT token and session for client-side gating |

## 15.2 — Order Tracking (Already Functional)

The existing order tracking page (`/[slug]/order/[id]`) already has a status stepper with polling. No rewrite needed — it's 329 lines with delivery and collection step progressions.

## 15.3 — PWA Foundation

| Feature | Description |
|---------|-------------|
| **Manifest API** | `/api/manifest/[slug]` — per-restaurant manifest.json with name, icons, theme colour. Cached 10 minutes |
| **Service worker** | `/public/sw.js` — cache-first for static assets, network-first for API (menu data). Push notification handling. Offline fallback page |
| **Registration** | Slug layout adds `<link rel="manifest">` and registers service worker on all ordering pages |
| **Offline page** | Friendly offline fallback with retry button |

## 15.4 — Email Compliance

| Feature | Description |
|---------|-------------|
| **Unsubscribe API** | `/api/unsubscribe?token=xxx` — HMAC-signed tokens per customer. Sets `marketing_opt_out = true`. Shows confirmation HTML page |
| **Marketing filter** | Send API now filters out customers with `marketing_opt_out = true`. Each email includes personalised unsubscribe link |

## 15.5 — Landing Page & Pricing

| Feature | Description |
|---------|-------------|
| **Landing page** | REWRITTEN — hero with value prop, commission comparison table, 6 feature cards, testimonials section, pricing preview, dual CTA (trial + demo) |
| **Pricing page** | NEW `/pricing` — 3-tier comparison, annual toggle, FAQ accordion (6 questions), setup fee section, CTA |
| **Demo link** | "See Live Demo" button points to `/demo-restaurant` (pre-seeded slug) |

## 15.6 — Analytics Foundation

| Feature | Description |
|---------|-------------|
| **PostHog integration** | `src/lib/analytics.ts` — initialisation, page view tracking, custom events, user identification. Privacy-first (memory persistence, no localStorage) |
| **Pre-defined events** | `menu_viewed`, `item_added_to_cart`, `checkout_started`, `order_completed`, `signup_started`, `signup_completed`, `trial_started`, `plan_upgraded`, `loyalty_stamp_earned`, `promo_code_applied` |

## 15.7 — Technical Debt Cleanup

| Fix | Description |
|-----|-------------|
| **Recharts double import** | Removed broken dynamic import wrapper, kept direct import |
| **Loyalty earn** | Replaced internal HTTP fetch in webhook with direct Supabase queries |
| **Marketing unsubscribe** | Replaced `#` href with signed unsubscribe token URLs |
| **Opted-out filter** | Marketing send now excludes customers with `marketing_opt_out = true` |

---

## New Files (11)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase15.sql` | 48 | Plan tiers, opt-out columns, push subscriptions |
| `src/lib/feature-gates.ts` | 129 | Plan feature definitions, gating functions, pricing config |
| `src/lib/analytics.ts` | 79 | PostHog integration and event tracking |
| `src/app/api/unsubscribe/route.ts` | 70 | Signed email unsubscribe handler |
| `src/app/api/manifest/[slug]/route.ts` | 55 | Per-restaurant PWA manifest |
| `src/app/pricing/page.tsx` | 158 | Public pricing page |
| `src/app/page.tsx` | 195 | Landing page rewrite |
| `public/sw.js` | 88 | Service worker |
| `public/offline.html` | 20 | Offline fallback |
| `PHASE15-CHANGELOG.md` | This file |

## Modified Files (9)

| File | Changes |
|------|---------|
| `src/lib/auth.ts` | Added `plan` to restaurant select, JWT token, and session |
| `middleware.ts` | Added feature gating import and path checking |
| `src/app/dashboard/billing/page.tsx` | REWRITTEN — 3-tier pricing cards, upgrade/downgrade, setup fee |
| `src/app/api/subscription/route.ts` | REWRITTEN — multi-plan management, setup fee checkout |
| `src/app/api/marketing/send/route.ts` | Signed unsubscribe URLs, opt-out filtering |
| `src/app/api/webhooks/stripe/route.ts` | Direct loyalty earn (replaced HTTP fetch) |
| `src/app/dashboard/reports/page.tsx` | Fixed Recharts double import |
| `src/app/[slug]/layout.tsx` | Added PWA manifest link and service worker registration |
| `package.json` | Added web-push, posthog-js |

---

## Exit Criteria

- [x] 3-tier pricing live with working upgrade/downgrade
- [x] Feature gating blocks loyalty/marketing on Starter plan
- [x] Order tracking page shows real-time status stepper (already existed)
- [x] PWA installable with menu caching and offline fallback
- [x] Marketing emails have working signed unsubscribe
- [x] Opted-out customers excluded from campaigns
- [x] Landing page is conversion-ready with pricing comparison
- [x] Pricing page with 3 tiers, FAQ, annual toggle
- [x] PostHog analytics integration ready
- [x] All technical debt from Phase 14 resolved
