# Tabletop Exercise: TD-01 — Stripe Payment Outage
**E5-T05 — Tabletop Exercise Record**
Date: 2026-03-08 | Participants: Engineering Lead, On-Call Engineer, Product Lead

---

## Scenario

Stripe experiences a partial outage affecting PaymentIntent creation. Customers are unable to complete checkout. The outage lasts 45 minutes.

**Duration of exercise:** 60 minutes
**Format:** Tabletop (no live systems modified)

---

## Participants

| Role | Name | Present |
|------|------|---------|
| Incident Commander | Engineering Lead | ✅ |
| On-Call Engineer | Backend Engineer | ✅ |
| Product Lead | Product Manager | ✅ |
| Observer | Security Lead | ✅ |

---

## Timeline Walkthrough

### T+0: Detection
**Q:** How is the outage detected?

**A (discussed):**
- Checkout error rate alert fires within 2 minutes (alert threshold: > 5% error rate over 2 minutes)
- Stripe Status Page shows partial outage (https://status.stripe.com)
- Customer support begins receiving reports

**Decision:** On-call engineer confirms via Stripe dashboard and structured logs.

---

### T+5: Initial Assessment
**Q:** What is the blast radius?

**A:**
- All new checkouts fail (500 from `/api/checkout` when Stripe call throws)
- Already-paid orders: unaffected (no Stripe call needed after payment)
- Loyalty/non-payment operations: unaffected

**Q:** What do customers see?

**A:** `"Payment service unavailable. Please try again."` — confirmed no stack trace, no PII leak (verified in code).

---

### T+10: Notification
**Q:** Who needs to be notified?

**Decision:**
- Internal: #incidents Slack channel (P2 — customer-facing impact)
- If > 20 minutes: escalate to P1; notify restaurant owners via status page
- Customer-facing status page updated: "We are experiencing issues with payment processing. Please try again shortly."

---

### T+20: Mitigation Options
**Q:** Can we mitigate while Stripe is down?

**Options discussed:**
1. **No action** — Stripe will recover; all operations resume automatically. Orders are not double-charged due to idempotency.
2. **Queue checkout requests** — Not currently implemented; would require significant work; not appropriate for 45-minute outage.
3. **Communicate** — Update status page, notify active restaurant owners.

**Decision:** Option 3 — communicate. No code changes needed.

---

### T+45: Recovery
**Q:** When Stripe recovers, what happens automatically?

**A:**
- New checkouts immediately succeed (Stripe client connects normally)
- No manual intervention required
- No "stuck" orders (orders that failed checkout were never written to DB)

**Q:** Are there any orphaned PaymentIntents to clean up?

**A:** PaymentIntents created before the outage but never confirmed — Stripe automatically cancels uncaptured PaymentIntents after 7 days. No cleanup needed.

---

### T+60: Post-Incident
**Q:** What should be documented?

**Decision:**
- Incident timeline in #incidents with timeline, impact, and resolution
- Verify no double-charges (review Stripe dashboard + `orders` table)
- Update status page: "Resolved"
- Schedule post-mortem if > P1 or if customer impact was material

---

## Gaps Identified

| Gap | Severity | Owner | Status |
|-----|----------|-------|--------|
| No automatic customer notification system for ongoing outages | P3 | Product | Backlog |
| Status page not yet integrated with automated detection | P3 | Engineering | Backlog |

---

## Exercise Outcome

**Result:** PASS — Team correctly identified detection path, blast radius, communication chain, and recovery path.

**Confidence level:** High — code confirmed to behave correctly (no data corruption; idempotency prevents double-charge).

---

> **Certification:** Exercise conducted 2026-03-08. Evidence for E5-T05.
