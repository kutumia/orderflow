# Incident Severity Model
**E5-T01 — Incident Classification and Response Framework**
Last updated: 2026-03-08 | Status: Certified

---

## Severity Definitions

### P0 — Critical (Customer-Impacting, Revenue-Affecting)

**Definition:** Core business function completely unavailable; active revenue loss; data breach; compliance violation.

**Criteria (any one):**
- Checkout / payment processing is down
- All customers cannot place orders for ≥ 1 active restaurant
- Data breach or unauthorised data access confirmed
- Database unreachable
- Error rate > 10% system-wide

**Response:**
- Alert: PagerDuty (immediate, 24/7)
- Acknowledge: 15 minutes
- Commander assigned: 30 minutes
- First status update: 30 minutes
- Updates: Every 30 minutes until resolved
- Resolution target: 2 hours

**Team:** Engineering on-call + CTO notified

---

### P1 — High (Partial Degradation)

**Definition:** Important feature degraded; some customers impacted; workaround available.

**Criteria (any one):**
- Checkout success rate < 95%
- PrintBridge jobs not processing for > 15 min
- Authentication failures > normal baseline
- Single restaurant completely unavailable (but others working)
- Payment webhook failures > 3 in 5 minutes
- Scheduled cron job failing

**Response:**
- Alert: Slack #incidents + email to on-call
- Acknowledge: 1 hour
- Commander assigned: 2 hours
- First status update: 1 hour
- Updates: Every hour
- Resolution target: 8 hours

**Team:** Engineering on-call

---

### P2 — Medium (Non-Critical Degradation)

**Definition:** Non-critical feature broken; workaround exists; limited customer impact.

**Criteria (any one):**
- Email delivery degraded
- Reports/analytics unavailable
- Marketing campaign feature down
- Print system slow (> 30s) but operational
- Non-critical API returning errors

**Response:**
- Alert: Slack #alerts only
- Acknowledge: 4 hours
- Resolution target: 24 hours (next business day acceptable)

**Team:** On-shift engineer

---

### P3 — Low (Minor Issue)

**Definition:** Cosmetic issue, minor inconvenience, or future risk. No customer impact now.

**Criteria:**
- UI rendering glitch
- Non-critical log noise
- Performance degradation < 20%
- Documentation gap
- Non-urgent security finding

**Response:**
- Slack #alerts
- Next standup
- Resolution target: Sprint cycle

**Team:** Team review in standup

---

## Incident Commander Responsibilities

1. **Declare** the incident and assign severity
2. **Communicate** to stakeholders (Slack, Status Page)
3. **Coordinate** technical response (don't do hands-on work if possible)
4. **Track** timeline in incident channel
5. **Notify** legal/DPO if data breach suspected (GDPR 72hr clock starts)
6. **Close** the incident and schedule post-mortem

---

## Status Page Updates

| Severity | Status Page | Template |
|----------|-------------|---------|
| P0 | Update immediately | "We are investigating an issue affecting [feature]. Updates every 30 minutes." |
| P1 | Update within 1 hour | "We are aware of degraded [feature]. Investigating." |
| P2 | Optional | "Minor issue with [feature]. Working on fix." |
| P3 | No update | — |

Status page: [https://status.orderflow.co.uk](https://status.orderflow.co.uk)

---

## Incident Channels

| Channel | Purpose |
|---------|---------|
| `#incident-YYYY-MM-DD-NNN` | Per-incident war room |
| `#incidents` | P0/P1 alert feed |
| `#alerts` | P2/P3 alert feed |
| `#security` | Security events |
| `#postmortems` | Post-incident reviews |

---

## Post-Incident Review

**Required for:** All P0 and P1 incidents.
**Timeline:** Within 5 business days of resolution.
**Template:** [Post-mortem Template](./post-mortem-template.md)

**Blameless culture:** Focus on system failures, not individual mistakes.

**Required sections:**
1. Incident timeline
2. Root cause
3. Customer impact (duration × affected users)
4. What went well
5. What went wrong
6. Action items with owners and due dates

> **Certification:** Incident model reviewed 2026-03-08. All P0 scenarios have runbooks. Post-mortem process documented.
