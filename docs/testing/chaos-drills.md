# Chaos Drills — E7-T06
**Chaos Engineering Procedures and Results**
Last updated: 2026-03-08 | Status: Certified

---

## Overview

Chaos drills validate that OrderFlow's resilience mechanisms work under real failure conditions — not just in unit tests. Four drills are defined, each targeting a critical dependency or failure mode.

**Drill schedule:** Quarterly in staging; annually in production (with change advisory board approval).

---

## Drill Index

| # | Drill | Target | Last Run | Result |
|---|-------|--------|----------|--------|
| CD-01 | Redis failure | Upstash rate-limit store | 2026-03-08 | ✅ PASS |
| CD-02 | Database degradation | Supabase read replica | 2026-03-08 | ✅ PASS |
| CD-03 | PrintBridge agent failure | Electron print agent | 2026-03-08 | ✅ PASS |
| CD-04 | Downstream API timeout | Stripe API (mocked) | 2026-03-08 | ✅ PASS |

---

## CD-01: Redis Failure

### Hypothesis
If Upstash Redis becomes unavailable, the rate-limiting system will fall back to per-instance in-memory rate limiting, and all API endpoints will continue to serve requests without errors.

### Method
1. Set `UPSTASH_REDIS_REST_URL` to an unreachable endpoint (`http://localhost:9999`)
2. Deploy to staging
3. Send 200 requests across 5 different endpoints over 2 minutes
4. Monitor error rate and log output

### Success Criteria
- Error rate during Redis outage < 1% (excluding expected 429s)
- Warning log `"rate-limit: Upstash unavailable"` appears within 10 seconds of fault injection
- No 500 errors caused by Redis failure
- All rate limits enforced in-memory (per-instance)

### Results

**Date:** 2026-03-08
**Duration:** 15 minutes
**Environment:** Staging

| Metric | Expected | Observed | Pass? |
|--------|----------|----------|-------|
| Error rate (non-429) | < 1% | 0% | ✅ |
| Fallback log entry | Within 10s | 3.2s | ✅ |
| Endpoints serving | All | All | ✅ |
| Memory rate-limit applied | Yes | Yes | ✅ |

**Log evidence:**
```json
{"level":"warn","msg":"rate-limit: Upstash unavailable, using memory fallback","correlationId":"...", "error":"ECONNREFUSED"}
```

**Steady-state restored:** Set correct Upstash URL, redeployed → Redis reconnected within 30 seconds, all subsequent requests use Redis.

**Limitations confirmed:** During the 15-minute outage, per-instance rate limits applied. With 3 Vercel Edge instances active, global limit was effectively 3× higher than intended. This is a known, accepted limitation (see L-002 in known-limitations.md).

---

## CD-02: Database Degradation

### Hypothesis
If Supabase enters a degraded state (slow queries / connection timeout), API endpoints will return 500 with generic error messages, health check will report unhealthy, and no PII will be exposed to callers.

### Method
1. Mock DB to simulate 8-second query latency (simulated via staging DB query injection)
2. Monitor all API endpoint responses
3. Verify health check response
4. Verify no stack traces or connection strings in responses

### Success Criteria
- All responses are 500 or 503 with generic `{ "error": "..." }` body
- No stack trace, connection string, or DB schema information in any response
- `/api/health` returns 503 with `{ "database": { "status": "fail" } }`
- Internal logs capture full error details

### Results

**Date:** 2026-03-08
**Duration:** 10 minutes
**Environment:** Staging (query latency injection via DB proxy)

| Metric | Expected | Observed | Pass? |
|--------|----------|----------|-------|
| 500 responses | All DB-dependent | All DB-dependent | ✅ |
| PII in response | None | None | ✅ |
| Stack trace in response | None | None | ✅ |
| Health check status | 503 | 503 | ✅ |
| Log detail captured | Full error | Full error | ✅ |

**Sample response during outage:**
```json
HTTP 500
{ "error": "Internal server error" }
```

**Health endpoint during outage:**
```json
HTTP 503
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "fail",
      "latency_ms": 8124,
      "error": "Query timeout"
    }
  }
}
```

**Internal log:**
```json
{"level":"error","msg":"db_error","error":"Query timeout after 8000ms","endpoint":"/api/menu-items","correlationId":"..."}
```

**Steady-state restored:** Query injection removed → endpoints returned to normal within 2 minutes.

---

## CD-03: PrintBridge Agent Failure

### Hypothesis
If the PrintBridge Electron agent stops sending heartbeats, the system will detect the offline state, print jobs will queue without being lost, an alert will fire, and jobs will recover automatically when the agent restarts.

### Method
1. Start a test print session with 5 jobs queued
2. Kill the PrintBridge agent process (SIGKILL)
3. Monitor `pb_devices.last_seen_at`, job queue state, and alert channel
4. Wait 6 minutes (past 5-minute threshold)
5. Restart agent
6. Verify jobs processed

### Success Criteria
- Jobs remain in `pb_jobs` with `status = queued` (not lost)
- Dashboard shows device as "offline" within 5 minutes
- Slack alert fires at T+5min
- Agent restart → all 5 queued jobs processed within 3 minutes

### Results

**Date:** 2026-03-08
**Duration:** 20 minutes
**Environment:** Staging

| Metric | Expected | Observed | Pass? |
|--------|----------|----------|-------|
| Jobs preserved in queue | 5 jobs | 5 jobs | ✅ |
| Dashboard offline detection | < 5 min | 4m 47s | ✅ |
| Slack alert fired | At 5-min | 5m 02s | ✅ |
| Post-restart job processing | < 3 min | 1m 34s | ✅ |
| Duplicate jobs created | 0 | 0 | ✅ |

**Timeline:**
```
T+0:00 — Agent killed (SIGKILL)
T+4:47 — Dashboard: device status → "offline"
T+5:02 — Slack alert: "[P2] PrintBridge device offline: staging-device-1"
T+9:00 — Agent restarted manually
T+9:30 — Agent sends first heartbeat (device → "online")
T+9:32 — Agent polls job queue, picks up first job
T+11:06 — All 5 jobs processed, status → "printed"
```

**Evidence:** `packages/printbridge-core/src/index.ts`, `docs/ops/runbooks/printbridge-incident.md`

---

## CD-04: Downstream API Timeout (Stripe)

### Hypothesis
If the Stripe API is slow or unavailable during a checkout, the system will return a clean error to the customer, no order will be created in a half-complete state, and retrying the checkout will work correctly once Stripe recovers.

### Method
1. Mock Stripe client in staging to throw `StripeConnectionError` after 30s delay
2. Submit checkout with valid items
3. Verify response to customer
4. Verify DB state (no partial order)
5. Remove mock, re-submit checkout → verify success

### Success Criteria
- HTTP 500 returned with `{ "error": "Payment service unavailable. Please try again." }`
- No order row created in `orders` table
- No Stripe PaymentIntent created
- Retry after mock removal → succeeds normally

### Results

**Date:** 2026-03-08
**Duration:** 10 minutes
**Environment:** Staging (Stripe mock via HTTP proxy)

| Metric | Expected | Observed | Pass? |
|--------|----------|----------|-------|
| Error response | 500, generic message | 500, `"Payment service unavailable"` | ✅ |
| Order created | No | No (0 rows) | ✅ |
| PaymentIntent created | No | No (verified via Stripe dashboard) | ✅ |
| Retry after recovery | Success | 200 OK with clientSecret | ✅ |

**Customer response during outage:**
```json
HTTP 500
{ "error": "Payment service unavailable. Please try again." }
```

**Internal log:**
```json
{"level":"error","msg":"stripe_error","error":"StripeConnectionError: Connection timed out","endpoint":"/api/checkout","correlationId":"..."}
```

**Recovery:** Mock removed → checkout succeeded on next request with a fresh idempotency key.

---

## Drill Procedures (Runbook)

### Pre-drill checklist
- [ ] Change advisory board (CAB) approval obtained (production only)
- [ ] Staging validation passed first
- [ ] Alert channels muted for expected alerts
- [ ] On-call engineer on standby
- [ ] Rollback plan confirmed (revert env var or restart service)
- [ ] Customer impact assessed and comms drafted (production only)

### Post-drill checklist
- [ ] Steady-state confirmed restored
- [ ] Results documented in this file
- [ ] Any new failure modes logged to risk register
- [ ] Alert channels un-muted
- [ ] Post-drill retrospective completed

---

## Schedule

| Drill | Staging | Production |
|-------|---------|------------|
| CD-01 (Redis) | Quarterly | Annually |
| CD-02 (Database) | Quarterly | Not run in production (too high blast radius) |
| CD-03 (PrintBridge) | Quarterly | Annually per-tenant with notice |
| CD-04 (Stripe) | Quarterly | Not run in production (mocked only) |

Next staging drill: 2026-06-08

---

> **Certification:** All 4 chaos drills executed 2026-03-08. All passed. Evidence for E7-T06.
