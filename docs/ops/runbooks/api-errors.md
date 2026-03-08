# Runbook: High API Error Rate
**E5-T02 — Operations Runbook**
Severity: P0 (>10% error rate) / P1 (>1% error rate)

---

## Trigger Conditions

- 5xx error rate > 1% over 5-minute window (P1)
- 5xx error rate > 5% over 5-minute window (P0)
- Checkout endpoint specifically: any 5xx rate > 2% (P0)

---

## Immediate Actions (0–15 minutes)

### 1. Confirm the incident

```bash
# Check health endpoint
curl -s https://orderflow.co.uk/api/health | jq .

# Check recent error logs in Vercel
# Vercel Dashboard → Deployments → Functions → Filter by status:500

# Check Datadog error rate dashboard
# Dashboard: "Platform Health" → "Error Rates" panel
```

### 2. Identify scope

- Is it one route or all routes?
- Is it one tenant or all tenants?
- Did it start after a deployment?

```bash
# Vercel: check recent deployments
# GitHub: check recent commits to main
git log --oneline -20

# Check if issue correlates with a deployment timestamp
```

### 3. Is it database-related?

```bash
curl -s https://orderflow.co.uk/api/health | jq '.checks.database'
```

If `database.status !== "ok"` → follow [Database Incident Runbook](./database-incident.md)

### 4. Is it a third-party failure?

- **Stripe:** Check https://status.stripe.com
- **Supabase:** Check https://status.supabase.com
- **Vercel:** Check https://www.vercel-status.com
- **Upstash:** Check https://status.upstash.com

If third-party down → communicate, enable graceful degradation, wait for recovery.

---

## Resolution Paths

### Path A: Bad deployment

```bash
# Roll back to previous deployment
vercel rollback --token $VERCEL_TOKEN
# OR via Vercel Dashboard: Deployments → Previous → Promote

# Verify rollback
curl -s https://orderflow.co.uk/api/health | jq '.status'
```

### Path B: Database overloaded

1. Check Supabase Dashboard → Database → CPU / Connections
2. If connection pool exhausted: enable connection pooler (PgBouncer)
3. If CPU > 80%: scale up compute in Supabase Dashboard
4. If specific query causing issues: identify in Supabase Logs → Slow Queries

### Path C: Memory/timeout in serverless function

1. Vercel Dashboard → Functions → identify high-duration functions
2. Check if there's an infinite loop or large payload
3. Add `maxDuration` limit to affected route
4. Roll back if introduced in recent deployment

### Path D: Rate limit false positives

```bash
# Check if rate limiter is too aggressive
# Look for 429 responses masking as 500s
# Temporarily increase limits if needed via env var change
vercel env set RATE_LIMIT_MULTIPLIER 2 --environment production
vercel --prod
```

---

## Communication Template

**Slack #incidents:**
```
:red-siren: P0 INCIDENT — High API Error Rate
Time detected: HH:MM UTC
Current error rate: X%
Affected: [All routes / checkout / specific route]
Status: Investigating
Next update: HH:MM UTC
Commander: @name
```

**Status Page:**
```
Investigating elevated error rates affecting the OrderFlow API.
Our team is actively investigating. We will provide an update within 30 minutes.
```

---

## Resolution Checklist

- [ ] Error rate back below 0.5% for 10+ minutes
- [ ] Health check returning `"healthy"`
- [ ] Checkout flow manually tested
- [ ] Root cause identified
- [ ] Status page updated: "Resolved"
- [ ] Incident channel pinned with timeline
- [ ] Post-mortem scheduled (P0/P1)
