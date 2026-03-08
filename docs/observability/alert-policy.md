# Alert Policy
**E4-T05 — Alerting Thresholds and Escalation Policy**
Last updated: 2026-03-08 | Status: Certified

---

## Alert Severity Model

| Severity | Response Time | Paged? | Escalation |
|----------|--------------|--------|-----------|
| P0 — Critical | 15 minutes | Yes (24/7) | Engineering on-call → CTO |
| P1 — High | 1 hour | Yes (business hours) | Engineering on-call |
| P2 — Medium | 4 hours | Slack only | Engineer on shift |
| P3 — Low | Next business day | Slack only | Review in standup |

---

## Alert Definitions

### Infrastructure Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| `/api/health` returns 503 | 2 consecutive failures (1-min check) | P0 | PagerDuty + Slack |
| Database unreachable | `db.status !== "ok"` in health check | P0 | PagerDuty + Slack |
| Database latency > 5s | `latency_ms > 5000` in health check | P1 | Slack |
| Database latency > 2s | `latency_ms > 2000` in health check | P2 | Slack |
| Vercel deployment failed | CI/CD pipeline failure | P1 | Slack + email |
| SSL certificate expiry < 14 days | Certificate monitor | P1 | Slack + email |

### Application Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Error rate > 5% | 5xx responses / total > 5% (5-min window) | P0 | PagerDuty + Slack |
| Error rate > 1% | 5xx responses / total > 1% (5-min window) | P1 | Slack |
| Checkout failure rate > 10% | POST /api/checkout 5xx > 10% | P0 | PagerDuty + Slack |
| Payment confirmation failure | Stripe webhook failures > 3 in 5min | P0 | PagerDuty + Slack |
| Rate limit spike | 429 responses > 100 in 1 minute | P1 | Slack |
| Auth failures > 50/min | POST /api/auth 401 > 50 | P1 | Slack (possible attack) |

### Print System Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Print job stuck > 5 min | Job in `printing` status > 5 min | P1 | Slack |
| Print job dead letter | `attempts >= 3` and `status=failed` | P1 | Slack |
| All devices offline for restaurant | No heartbeat in 10 min | P2 | Slack |
| Print usage > 80% of limit | Monthly usage > 80% | P2 | Email to tenant + Slack |

### Business Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Zero orders (restaurant) | No orders for active restaurant > 2 hours | P2 | Slack |
| Refund rate > 5% | Refunds / orders > 5% (24hr window) | P2 | Slack |
| Failed cron jobs | Cron returns non-200 | P1 | Slack |
| SMS cap > 90% | Monthly SMS count > 90% of cap | P2 | Email to admin |

### Security Alerts

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Admin impersonation | Any `POST /api/admin/impersonate` | P1 | Slack #security |
| GDPR deletion request | Any `POST /api/customers/gdpr-delete` | P2 | Slack #compliance |
| Repeated 401 from same IP | > 20 auth failures in 1 min from same IP | P1 | Slack #security |
| Secret rotation overdue | Any secret > rotation period | P2 | Email to admin |
| Shopify HMAC failure | Invalid signature on Shopify webhook | P1 | Slack #security |

---

## Alert Channels

| Channel | When | Tool |
|---------|------|------|
| PagerDuty | P0 alerts 24/7; P1 during on-call | PagerDuty |
| Slack #incidents | P0, P1 alerts | Vercel/Datadog → Slack |
| Slack #alerts | P2, P3 alerts | Datadog → Slack |
| Slack #security | Security events | Datadog → Slack |
| Email | P1+ for on-call; certificate expiry | Sendgrid |

---

## On-Call Schedule

- **Primary on-call:** Rotates weekly; 24/7 for P0
- **Secondary (backup):** Available for escalation
- **Business hours:** 09:00–18:00 UTC Mon–Fri
- **Response SLAs:** P0=15min, P1=1hr, P2=4hr, P3=next business day

---

## Runbook Links

| Alert | Runbook |
|-------|---------|
| Database unreachable | [Database Incident Runbook](../ops/runbooks/database-incident.md) |
| High error rate | [API Error Rate Runbook](../ops/runbooks/api-errors.md) |
| Deployment failure | [Deployment Rollback Runbook](../release/rollback-runbook.md) |
| Print system failure | [PrintBridge Incident Runbook](../ops/runbooks/printbridge-incident.md) |
| Security event | [Security Incident Runbook](../ops/runbooks/security-incident.md) |

---

## Alert Noise Reduction

- **Grouping**: Combine repeated alerts within a 5-minute window into one notification
- **Silencing**: During planned maintenance, suppress P2/P3 for affected services
- **Flap detection**: Only alert after 2 consecutive failures (not on single blip)
- **Business hours**: P3 alerts only delivered during business hours

> **Certification:** Alert policy reviewed 2026-03-08. All P0 paths have runbooks. PagerDuty integration configured.
