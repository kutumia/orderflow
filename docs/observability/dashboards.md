# Observability Dashboards
**E4-T04 — Dashboard Specifications and Key Metrics**
Last updated: 2026-03-08 | Status: Certified

---

## Dashboard Index

| Dashboard | Tool | Audience | Refresh |
|-----------|------|----------|---------|
| Platform Health | Datadog | Engineering | 1 min |
| Order Funnel | Datadog | Product / Business | 5 min |
| Print System | Datadog | Operations | 1 min |
| Security Events | Datadog | Security | 5 min |
| Vercel Deployment | Vercel Dashboard | Engineering | Real-time |

---

## Platform Health Dashboard

### Panels

**1. Service Status**
- `/api/health` → `status` field (gauge: healthy/degraded/unhealthy)
- Database latency → `checks.database.latency_ms` (time series)
- API p50/p95/p99 response times (histogram)

**2. Error Rates**
- 5xx error rate: `count(status:5xx) / count(*) * 100` (time series, %)
- 4xx error rate: same pattern (time series, %)
- Errors by route: Top 10 routes by error count (table)

**3. Request Volume**
- Requests per minute (time series)
- Requests by route (top 20, bar chart)
- Geographic distribution (world map)

**4. Rate Limiting**
- 429 responses per minute (time series)
- Top rate-limited IPs (table)
- Rate limit hits by bucket (bar chart)

**5. Infrastructure**
- Vercel function duration p95 (time series)
- Cold start rate (%) (time series)
- Concurrent executions (gauge)

---

## Order Funnel Dashboard

### Panels

**1. Checkout Funnel**
- Checkout attempts per hour
- Checkout success rate (%) = orders_paid / checkout_attempts
- Payment failure reasons (pie chart)
- Average order value (time series)

**2. Order Flow**
- Orders by status (stacked bar: pending/confirmed/preparing/ready/delivered)
- Order status transition times (heatmap)
- Refund rate (%) (time series)

**3. Revenue**
- GMV per hour (time series)
- Platform fee revenue (time series)
- Top restaurants by GMV (table)
- Active tenants count (gauge)

**4. Loyalty & Promo**
- Promo code usage rate (%)
- Loyalty points issued/redeemed ratio
- Email campaign open rates

---

## Print System Dashboard

### Panels

**1. Job Pipeline**
- Jobs queued (gauge, real-time)
- Jobs in printing (gauge)
- Jobs completed per hour (counter)
- Failed jobs (counter, with alert threshold line)

**2. Agent Health**
- Active agents (devices with heartbeat < 5 min)
- Last heartbeat time per device (table)
- Agent uptime % (gauge)

**3. Performance**
- Time from queued → printed (percentiles: p50, p95)
- Retry rate (% of jobs that needed retry)
- Dead letter count (jobs with attempts ≥ 3)

**4. Usage vs Quota**
- Monthly print usage per tenant (bar chart)
- Tenants > 80% of limit (alert panel)
- API key usage frequency (table)

---

## Security Events Dashboard

### Panels

**1. Authentication**
- Login success/failure rate (time series)
- Failed logins by IP (table, top 20)
- Password reset requests per hour
- JWT mismatch events (time series)

**2. API Security**
- HMAC verification failures (Shopify + Stripe + PrintBridge)
- Cron authentication failures
- Invalid API key attempts
- Admin impersonation events (table: who, when, target)

**3. Rate Limiting**
- Rate-limited IPs (table, geo-mapped)
- Busiest buckets (checkout, login, mutation)
- Blocked requests trend (time series)

**4. Data Access**
- GDPR requests (export/delete by date)
- Cross-tenant attempt blocks (if any logged)
- Unusual access patterns (anomaly detection)

---

## SLO Tracking

| SLO | Target | Measurement Window | Alert Threshold |
|-----|--------|-------------------|-----------------|
| API availability | 99.9% | 30 days | < 99.5% → P0 |
| Checkout success rate | 99% | 24 hours | < 97% → P0 |
| p95 API latency | < 500ms | 1 hour | > 1s → P1 |
| Print delivery time (p95) | < 30s | 1 hour | > 60s → P1 |
| Health check passing | 100% | 5 minutes | Any failure → P0 |

> **Certification:** Dashboard specs reviewed 2026-03-08. Datadog integration configured via Vercel Log Drain.
