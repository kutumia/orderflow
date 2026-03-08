# Runbook: PrintBridge System Failure
**E5-T02 — Operations Runbook**
Severity: P1 (jobs not processing) / P2 (single agent offline)

---

## Trigger Conditions

- Print jobs stuck in `queued` for > 5 minutes
- Print jobs stuck in `printing` for > 5 minutes (agent crash mid-job)
- All devices offline for a restaurant (no heartbeat in 10 min)
- Dead letter jobs (attempts ≥ 3, status = failed)

---

## Immediate Actions

### 1. Check system status

```bash
curl -s https://orderflow.co.uk/api/health | jq .

# Check job queue via admin panel or direct DB query
# SELECT status, count(*) FROM pb_jobs GROUP BY status;

# Check device heartbeats
# SELECT name, last_seen_at FROM pb_devices WHERE last_seen_at > NOW() - INTERVAL '10 min';
```

### 2. Identify the layer that's failing

| Symptom | Likely Cause | Resolution Path |
|---------|-------------|-----------------|
| Jobs stuck in `queued` | Agent offline / not polling | Path A: Agent restart |
| Jobs stuck in `printing` | Agent crashed mid-print | Path B: Force reset job |
| Print job created but no receipt | Printer hardware issue | Path C: Hardware check |
| API returning errors | API layer issue | See [API Error Runbook](./api-errors.md) |

---

## Resolution Paths

### Path A: Agent offline — restart PrintBridge desktop app

1. Remote desktop to the restaurant's printer PC (if accessible)
2. Check PrintBridge app is running (system tray icon)
3. Restart the PrintBridge application
4. Verify heartbeat appears in dashboard within 2 minutes
5. Stuck jobs will be re-queued automatically on next poll

### Path B: Force-reset stuck job

```sql
-- Reset job stuck in 'printing' back to 'queued'
UPDATE pb_jobs
SET status = 'queued', attempts = attempts, error_message = 'Force reset by operator'
WHERE status = 'printing'
  AND tenant_id = '<tenant_id>'
  AND created_at < NOW() - INTERVAL '5 minutes';
```

### Path C: Dead letter jobs — escalate to restaurant

1. Notify restaurant owner via email/phone
2. Dead letter jobs cannot be auto-recovered
3. Restaurant should manually reprint from their order management screen
4. Mark jobs as `failed` and close

### Path D: Manual fallback print

If agent is down and restaurant needs immediate receipt:
1. Restaurant can use `/api/print-fallback` endpoint (browser-based print)
2. Or use email receipt as fallback

---

## Operator Tools

```bash
# Re-queue all failed jobs for a tenant (max 3 attempts already met → manual reset)
# Run via Supabase SQL editor:

UPDATE pb_jobs
SET status = 'queued', attempts = 0, error_message = 'Manual re-queue by operator'
WHERE tenant_id = '<TENANT_ID>'
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour';

# View recent job history for debugging
SELECT id, status, attempts, error_message, created_at, printed_at
FROM pb_jobs
WHERE tenant_id = '<TENANT_ID>'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Resolution Checklist

- [ ] Job queue length back to 0 (or acceptable)
- [ ] Device heartbeat confirmed within last 2 minutes
- [ ] Test job printed successfully
- [ ] Dead letter jobs handled (re-queued or restaurant notified)
- [ ] Root cause identified
- [ ] Monitoring confirmed no regression
