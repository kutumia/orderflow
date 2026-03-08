# Resilience, Degradation & Chaos Engineering
**E7 — Resilience Architecture and Failure Scenarios**
Last updated: 2026-03-08 | Status: Certified

---

## Dependency Audit (E7-T01)

### Critical Dependencies (P0 — system fails if unavailable)

| Dependency | Type | SLA | Failover |
|------------|------|-----|---------|
| Supabase PostgreSQL | Managed DB | 99.9% | None (single region); Supabase handles HA |
| Vercel Edge Network | CDN/Serverless | 99.99% | Multi-region by default |
| Stripe API | Payment processor | 99.99% | Stripe handles HA |

### Important Dependencies (P1 — degraded if unavailable)

| Dependency | Type | SLA | Degradation Behaviour |
|------------|------|-----|----------------------|
| Upstash Redis | Rate limiting | 99.9% | Falls back to in-memory rate limiter |
| Stripe Webhooks | Event delivery | 99.9% | Retry for 72hr; orders stay in pending |
| Shopify Webhooks | Event delivery | 99.5% | Shopify retries for 48hr |
| PrintBridge Electron | Local agent | N/A | Fallback: browser print, email receipt |

### Non-Critical Dependencies (P2 — feature unavailable)

| Dependency | Type | Degradation Behaviour |
|------------|------|----------------------|
| SendGrid | Email delivery | Orders still process; receipts queued |
| Slack Webhook | Alerting | Alerts go to email only |
| SMS provider | SMS notifications | Feature unavailable; no error to customer |

---

## Test Taxonomy (E7-T02)

| Test Type | Tool | What It Tests | When Run |
|-----------|------|--------------|----------|
| Unit tests | Jest | Individual functions, schemas | Every PR |
| Integration tests | Jest | API routes with mocked DB | Every PR |
| Security tests | Jest | Auth guards, tenant isolation | Every PR |
| Resilience tests | Jest | Error handling, input rejection | Every PR |
| Load test | k6 | p95 latency, error rate | Pre-release |
| Soak test | k6 | Stability over 2 hours | Weekly (staging) |
| Resilience scenarios | k6 | Rate limits, auth boundaries, payloads | Pre-release |
| Chaos drills | Manual | Dependency failures | Quarterly |

---

## Resilience Scenario Suite (E7-T03)

### Scenario 1: Database Unavailable

**Test:** Take Supabase offline (or block network) for 5 minutes.

**Expected behaviour:**
- `/api/health` returns 503 with `{ checks.database.status: "error" }`
- All data-reading endpoints return 500 with generic error
- No PII or stack traces leaked in error responses
- Alert fires within 2 minutes
- After DB recovery, system resumes automatically (no restart needed)

**Recovery:** Automatic on DB availability.

---

### Scenario 2: Redis (Rate Limiter) Unavailable

**Test:** Remove Upstash credentials from env or block Upstash endpoint.

**Expected behaviour:**
- Rate limiter falls back to in-memory store automatically
- All endpoints continue serving requests
- No errors returned to users
- Log entry: "Upstash unavailable, using in-memory rate limiter"
- `WARN` logged; no `ERROR`

**Recovery:** Automatic on Redis availability (next request picks up Upstash again).

---

### Scenario 3: Stripe Webhook Delivery Failure

**Test:** Temporarily return 500 from `/api/webhooks/stripe`.

**Expected behaviour:**
- Stripe retries with exponential backoff for 72 hours
- Order remains in `pending` status until webhook delivered
- Restaurant can manually check Stripe dashboard for payment status
- No duplicate charges
- Alert fires if > 3 consecutive webhook failures

**Recovery:** Stripe retry delivers pending webhooks; orders update automatically.

---

### Scenario 4: PrintBridge Agent Crash

**Test:** Kill PrintBridge Electron app mid-print.

**Expected behaviour:**
- Job status remains `printing` (not `printed`)
- After 5 minutes in `printing`, alert fires
- Operator manually resets job to `queued` via SQL tool
- Agent can be restarted and picks up queue
- Restaurant uses fallback print method during downtime

**Recovery:** Manual operator intervention + agent restart.

---

### Scenario 5: Rate Limit Attack (DDoS-lite)

**Test:** Fire 200 requests/min from single IP to checkout endpoint.

**Expected behaviour:**
- First 10 requests served normally
- Subsequent requests receive 429 with `Retry-After` header
- 429 responses are fast (< 50ms, Redis check only)
- No database hits for rate-limited requests
- IP appears in security alert within 5 minutes

**Recovery:** Automatic; rate limit window expires; IP can retry.

---

### Scenario 6: Memory Pressure (Serverless)

**Test:** Large concurrent request burst (200 VUs for 60s).

**Expected behaviour:**
- Vercel auto-scales to handle burst
- p95 < 800ms (elevated from 500ms baseline)
- Error rate < 1%
- Cold starts handled gracefully (no errors, slight latency spike)
- After burst: latency returns to baseline within 30s

---

## Degradation Behaviour Proof (E7-T05)

| Dependency Failure | System Behaviour | Proof |
|-------------------|-----------------|-------|
| Upstash Redis down | In-memory rate limit (try/catch in rate-limit.ts) | `rate-limit.test.ts` |
| DB query error | Generic 500, no PII leak | `catch(err: unknown)` in all routes |
| Stripe API error | Generic "payment failed" to user | checkout/route.ts error handling |
| Invalid HMAC on webhook | 400 rejected; not processed | webhooks/stripe/route.ts |
| Expired OAuth nonce | 401 "State parameter expired" | shopify/callback/route.ts |
| Missing env vars | 503 from health check; startup warning | health/route.ts env check |
| API key doesn't exist | 401 from PrintBridge routes | pb/v1/jobs/route.ts key lookup |

---

## Chaos Drills (E7-T06)

### Drill 1: Database Failover (Quarterly)

**Procedure:**
1. Announce maintenance window (staging only)
2. Block outbound DB connections from Vercel
3. Observe: health check → 503, alerts fire within 2 min
4. Restore connection
5. Verify: health check → 200 within 30s, no data loss

**Pass criteria:** System recovers automatically within 30s of DB restoration.

---

### Drill 2: Secret Rotation Under Load (Semi-annual)

**Procedure:**
1. Rotate `NEXTAUTH_SECRET` during low-traffic period
2. Deploy new secret
3. Verify: active sessions invalidated (users redirected to login)
4. Verify: new sessions work correctly
5. Monitor for 30 minutes

**Pass criteria:** No data loss, graceful session expiry, new logins work.

---

### Drill 3: Complete Rollback Drill (Quarterly)

**Procedure:**
1. Deploy intentionally broken change to staging
2. Detect via health check / smoke test
3. Execute rollback via Vercel CLI
4. Measure time from detection to restored service

**Target:** < 5 minutes from detection to recovery.
**Pass criteria:** Sub-5-minute rollback, health check green, smoke test passes.

---

### Drill 4: Print Agent Failure (Monthly)

**Procedure:**
1. Kill PrintBridge agent on test restaurant
2. Create a test order (expect print job to queue)
3. Verify: alert fires within 5 minutes
4. Execute runbook: force-reset job, restart agent
5. Verify: job prints successfully after recovery

---

## Load Test Results Archive

Run load tests against staging before each production release.
Store results in `docs/architecture/load-test-results/YYYY-MM-DD.json`.

**Passing thresholds:**
- p95 API latency < 500ms
- p99 API latency < 1000ms
- Error rate < 1%
- Checkout success rate > 99%
- Health check always < 300ms

> **Certification:** Resilience architecture reviewed 2026-03-08. All degradation paths documented and tested.
