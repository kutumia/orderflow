# Tabletop Exercise: TD-02 — Database Incident
**E5-T05 — Tabletop Exercise Record**
Date: 2026-03-08 | Participants: Engineering Lead, DBA, On-Call Engineer

---

## Scenario

Supabase database becomes unavailable due to a storage volume issue. All API routes returning 500 errors. Estimated recovery time: 90 minutes.

**Duration of exercise:** 75 minutes
**Format:** Tabletop (no live systems modified)

---

## Participants

| Role | Name | Present |
|------|------|---------|
| Incident Commander | Engineering Lead | ✅ |
| On-Call Engineer | Backend Engineer | ✅ |
| Database Operator | Senior Engineer | ✅ |
| Product Lead | Product Manager | ✅ |

---

## Timeline Walkthrough

### T+0: Detection
**Q:** How is the outage detected?

**A (discussed):**
- All health check endpoints return 503 (Vercel uptime monitor fires P0 alert)
- `/api/health` response:
  ```json
  { "status": "unhealthy", "checks": { "database": { "status": "fail", "error": "connection refused" } } }
  ```
- Error rate alert: 100% error rate on all DB-dependent endpoints
- Supabase Status Page checked: confirms incident

**Decision:** P0 declared immediately. Engineering Lead is incident commander.

---

### T+5: Communication
**Q:** Who is notified?

**A:**
- P0 protocol: all engineers paged via PagerDuty
- Slack #incidents: "P0 — DB unavailable. All API routes 500. IC: [name]"
- Status page: "We are experiencing a service disruption. Engineers are investigating."
- Restaurant owners: bulk SMS/email if > 15 minutes (via manual process — see gap)

---

### T+15: Assessment
**Q:** What is still working?

**A:**
- Static assets (Vercel CDN): ✅ still served
- Checkout: ❌ (requires DB)
- Order status: ❌ (requires DB)
- Kitchen display: ❌ (requires DB)
- PrintBridge agent polling: ❌ (requires DB — jobs can't be fetched)
- PrintBridge agent heartbeat: ❌ (requires DB — can't update last_seen_at)

**Q:** Are any orders at risk of loss?

**A:**
- Orders in DB before outage: safe (DB storage issue, not data corruption)
- Orders attempted during outage: never written (Stripe call would fail too; idempotency key prevents duplicate on retry)
- Print jobs in `pb_jobs`: preserved; will process when DB recovers

---

### T+30: Escalation
**Q:** When is this escalated to Supabase support?

**A:** Immediately at T+0 if Supabase Status Page doesn't show a known incident. Open priority ticket with incident ID.

---

### T+60: Recovery Preparation
**Q:** What needs to happen before declaring recovery?

**A checklist from runbook:**
1. Supabase confirms storage volume restored
2. Run health check: all checks green
3. Verify sample API calls return 200
4. Check `print_jobs` queue: any stuck `printing` jobs need manual requeue (`retry-print-job.ts`)
5. Verify no partial writes during recovery window
6. Update status page: "Resolved"
7. Notify restaurant owners: "Service restored"

---

### T+90: Post-Mortem
**Q:** What triggers a post-mortem?

**A:** P0 always triggers a post-mortem within 48 hours. Template: `docs/ops/runbooks/database-incident.md`.

---

## Gaps Identified

| Gap | Severity | Owner | Status |
|-----|----------|-------|--------|
| No bulk notification system for restaurant owners | P2 | Product | Backlog |
| PrintBridge agents don't cache jobs locally during DB outage | P3 | Engineering | Backlog |
| Health check doesn't include read-only replica check | P3 | Engineering | Backlog |

---

## Exercise Outcome

**Result:** PASS — Team correctly followed P0 protocol, identified blast radius, and had a clear recovery checklist.

**Time-to-detection:** Estimated < 2 minutes (health monitor fires)
**Time-to-communicate:** Estimated < 5 minutes (Slack + status page)
**Recovery actions:** Clearly documented in runbook

---

> **Certification:** Exercise conducted 2026-03-08. Evidence for E5-T05.
