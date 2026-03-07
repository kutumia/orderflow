# Phase 14: Scale & Performance

**New files:** 7 | **Modified files:** 7

---

## Deployment

1. Run `supabase/migration-phase14.sql` in Supabase SQL Editor
2. `npm install` (new: sharp, @next/bundle-analyzer)
3. Optional: Enable pg_cron for `refresh_daily_summaries()` hourly
4. Optional: Set up UptimeRobot monitoring on `/api/health`
5. Deploy

---

## 14.1 — Database & API Performance

| Feature | Description |
|---------|-------------|
| **Performance indexes** | 8 new indexes: partial index on active orders, customer email lookup, date-based reports, queued print jobs, loyalty cards, campaigns. All targeting the most common query patterns |
| **Materialised view** | `daily_order_summaries` aggregates orders by restaurant + date. Includes order count, revenue, avg value, delivery/collection split, discounts, VAT, refunds. Refreshable via `refresh_daily_summaries()` function |
| **API caching** | `src/lib/cache.ts` — in-memory LRU cache (500 entries) with TTL. Restaurant data cached 5 minutes. Drop-in replacement for Upstash Redis |
| **Image optimization** | Upload API now resizes to max 800px, converts to WebP (quality 82), generates 400px thumbnail. Uses `sharp`. Falls back to raw upload if sharp unavailable |
| **Response caching headers** | `/api/restaurants` returns `s-maxage=120, stale-while-revalidate=300` for CDN caching |

## 14.2 — Multi-Tenant Hardening

| Feature | Description |
|---------|-------------|
| **RLS audit tests** | `src/__tests__/rls-audit.test.ts` — structural verification that all API routes scope by restaurant_id. Tests session scoping, GDPR isolation, print job scoping |
| **Custom domains** | `custom_domain` column on restaurants. Middleware rewrites custom domain requests to the restaurant's ordering page. Settings page has domain config with CNAME instructions |
| **Multi-location schema** | `restaurant_ids UUID[]` on users table. Backfill migration from existing `restaurant_id`. Foundation for restaurant switcher |

## 14.3 — Load Testing & Monitoring

| Feature | Description |
|---------|-------------|
| **k6 load tests** | `k6/load-test.js` — 3 scenarios: 100 VU menu browsing, 50 VU checkout flows, 20 VU dashboard. Thresholds: p95 < 500ms, error rate < 1% |
| **Health endpoint** | `/api/health` — returns DB status, latency, timestamp, version, env. 200 if healthy, 503 if degraded. For UptimeRobot/Pingdom |

## 14.4 — Code Splitting & Bundle

| Feature | Description |
|---------|-------------|
| **Bundle analyzer** | `@next/bundle-analyzer` added. Run `npm run analyze` to generate bundle visualisation |
| **Dynamic imports** | Recharts on reports page loaded via `next/dynamic` for code splitting (~200KB saved from initial bundle) |
| **WebP image format** | `next.config.js` configured to serve WebP via Next.js Image component |

---

## New Files (7)

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase14.sql` | 90 | Indexes, materialised view, custom domain, multi-location |
| `src/lib/cache.ts` | 72 | In-memory LRU cache with TTL |
| `src/lib/image-optimize.ts` | 85 | Sharp-based image resize/WebP/thumbnail |
| `src/app/api/health/route.ts` | 40 | Health check endpoint |
| `src/__tests__/rls-audit.test.ts` | 108 | RLS cross-tenant security audit |
| `k6/load-test.js` | 120 | k6 load test scenarios |
| `PHASE14-CHANGELOG.md` | This file |

## Modified Files (7)

| File | Changes |
|------|---------|
| `middleware.ts` | REWRITTEN — custom domain support, new OWNER_ONLY_PATHS for loyalty/marketing/qr |
| `src/app/api/upload/route.ts` | REWRITTEN — sharp image optimization (resize, WebP, thumbnails) |
| `src/app/api/restaurants/route.ts` | Added cache wrapper (5 min TTL), removed stale error check |
| `src/app/dashboard/reports/page.tsx` | Recharts dynamic import for code splitting |
| `src/app/dashboard/settings/page.tsx` | Custom domain field with CNAME instructions |
| `next.config.js` | Bundle analyzer, WebP images, cache headers |
| `package.json` | Added sharp, @next/bundle-analyzer, analyze script |

---

## Exit Criteria

- [x] Performance indexes cover top query patterns
- [x] Materialised view for daily order summaries
- [x] Image optimisation (WebP + thumbnails) on upload
- [x] API caching layer (in-memory, Upstash-compatible interface)
- [x] Custom domain support in middleware
- [x] Multi-location schema foundation
- [x] k6 load tests ready to run
- [x] Health endpoint for uptime monitoring
- [x] Bundle analyzer configured
- [x] Recharts dynamically imported
