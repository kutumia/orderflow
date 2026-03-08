# Tabletop Exercise: TD-04 — PrintBridge Mass Failure
**E5-T05 — Tabletop Exercise Record**
Date: 2026-03-08 | Participants: Engineering Lead, On-Call Engineer, Support Lead

---

## Scenario

PrintBridge agents at 12 restaurants simultaneously go offline during peak Friday dinner service (6pm–9pm). Print jobs are queuing but not printing. Restaurants are unable to receive orders.

**Duration of exercise:** 60 minutes
**Format:** Tabletop (no live systems modified)

---

## Participants

| Role | Name | Present |
|------|------|---------|
| Incident Commander | Engineering Lead | ✅ |
| On-Call Engineer | Backend Engineer | ✅ |
| Support Lead | Customer Success | ✅ |
| Observer | Product Lead | ✅ |

---

## Timeline Walkthrough

### T+0: Detection
**Q:** How is the mass failure detected?

**A:**
- Alert: `[P2] PrintBridge device offline: <device-id>` fires at T+5 min per device
- If 3+ devices offline within 10 minutes: auto-escalate to P1
- Support receives restaurant calls within minutes of service impact

---

### T+5: Triage
**Q:** Is this a platform issue or individual agent issues?

**Diagnostic steps:**
1. Check `pb_devices.last_seen_at` across all affected restaurants — same timestamp cutoff → likely a platform issue (API Gateway, DB, network)
2. Check API Gateway logs for errors on PrintBridge routes
3. Check Supabase DB — is the `pb_jobs` table accessible?
4. Check if agents are sending heartbeats (auth failing vs network vs poll failing)

**Q:** What if it's an API Gateway deployment issue?

**A:** Roll back API Gateway via `wrangler rollback` — see `docs/release/rollback-runbook.md`.

---

### T+15: Immediate Mitigation
**Q:** Can restaurants continue without printing?

**A:**
- Digital order display (kitchen display via web) still works
- Restaurant staff can view orders on the OrderFlow dashboard
- Advised workaround: use kitchen display while print is restored

**Q:** What about already-queued jobs?

**A:** Jobs remain in `pb_jobs` with `status = queued`. They are NOT lost. Once agents recover, they will process automatically.

---

### T+30: Fix Identification
**Scenario A: API Gateway issue**
- Roll back to last known good deployment
- Verify `/api/pb/v1/health` returns 200
- Agents will reconnect on next poll (30 seconds)

**Scenario B: DB connectivity issue from Workers**
- Check Supabase connection limits; Workers may have exhausted connections
- Temporarily reduce agent poll interval via config
- Apply DB connection pooler if needed

**Scenario C: Agents need restart (local issue)**
- Support team contacts each restaurant; they restart the PrintBridge application
- Provide restart instructions: "Close the PrintBridge app from the system tray and reopen it"

---

### T+45: Recovery Verification
**Checklist:**
1. All devices showing "online" in dashboard
2. Queued jobs processing (count decreasing)
3. No duplicate print jobs (idempotency enforced at agent level)
4. Alert channels confirmed resolved in Slack

**Q:** How to verify no duplicate prints?

**A:** Query `pb_jobs`:
```sql
SELECT id, status, attempts, printed_at
FROM pb_jobs
WHERE created_at > '<incident_start>'
ORDER BY order_id, created_at;
```
Each order should have exactly 1 `printed` job. If `attempts > 1`, job was retried but not duplicated.

---

### T+60: Post-Incident
**Q:** Do restaurant owners receive compensation?

**A:** Per contract SLA — if outage > 30 minutes during peak hours, credit may be applied. Product team decision.

---

## Gaps Identified

| Gap | Severity | Owner | Status |
|-----|----------|-------|--------|
| No bulk notification to affected restaurants during mass failure | P2 | Product | Backlog |
| PrintBridge agents don't have offline-mode queue (store locally) | P3 | Engineering | Q3 2026 |
| P1 escalation threshold not yet automated (manual monitoring) | P2 | Engineering | Sprint 3 |
| Agent auto-update mechanism not implemented | P2 | Engineering | Q3 2026 |

---

## Exercise Outcome

**Result:** PASS — Team had clear triage path, workaround (kitchen display), and recovery procedure.

**Key learning:** The greatest risk is restaurants not knowing there's a fallback. Support team must have a "PrintBridge is down — use kitchen display" script ready. This should be part of restaurant onboarding.

---

> **Certification:** Exercise conducted 2026-03-08. Evidence for E5-T05.
