# Tabletop Exercise: TD-05 — Suspected Data Breach
**E5-T05 — Tabletop Exercise Record**
Date: 2026-03-08 | Participants: Engineering Lead, Security Lead, Legal

---

## Scenario

A security researcher contacts OrderFlow reporting that customer order data (names, addresses, email addresses) for multiple restaurants appears to have been exposed. The researcher provides a sample dataset with 50 records. The data appears genuine.

**Duration of exercise:** 90 minutes
**Format:** Tabletop (no live systems modified)

---

## Participants

| Role | Name | Present |
|------|------|---------|
| Incident Commander | Security Lead | ✅ |
| Engineering Lead | Engineering Lead | ✅ |
| Legal Counsel | (External) | ✅ |
| CTO | CTO | ✅ |

---

## Timeline Walkthrough

### T+0: Initial Report
**Q:** What is the immediate response to the researcher's contact?

**A:**
1. Acknowledge receipt within 1 hour (professional courtesy + legal best practice)
2. Do NOT confirm or deny breach publicly
3. Secure researcher communication: use encrypted channel
4. Engage legal immediately — all communications are potentially discoverable
5. Begin internal investigation under legal privilege where possible

---

### T+15: Evidence Assessment
**Q:** How do you verify the data is genuine OrderFlow data?

**A (engineering steps):**
1. Take the 50 sample records
2. Hash the email addresses and compare against `orders` table — do NOT log the raw PII
3. If match confirmed: breach is real; escalate immediately
4. Identify which restaurant(s) the records belong to
5. Identify the time range of the data (created_at range from order IDs)

---

### T+20: Source Investigation
**Q:** How was the data likely exfiltrated?

**Investigation checklist:**
1. **Audit logs:** Query `audit_logs` for `gdpr.export` events, `admin.impersonation`, `auth.login_success` from unusual IPs
2. **API logs:** Check for bulk data export patterns (high volume of GET requests to `/api/orders?restaurantId=*`)
3. **Service-role key usage:** Was the key compromised? Check for unusual Supabase direct API calls
4. **RLS check:** Were any RLS policies misconfigured? Check migration history
5. **Shopify webhook:** Could data have been exfiltrated via the Shopify integration?
6. **Third-party dependencies:** npm audit for known supply chain issues

---

### T+30: Containment
**Q:** What is contained immediately?

**Based on investigation findings:**

| Finding | Containment action |
|---------|-------------------|
| Compromised API key | Rotate immediately; see rotation runbook |
| Compromised user account | Disable account; purge sessions |
| RLS misconfiguration | Apply fix migration; audit all affected queries |
| No clear source found | Lock down all write endpoints temporarily; increase monitoring |

---

### T+45: Regulatory Assessment
**Q:** Is ICO notification required?

**UK GDPR Article 33 — 72-hour rule:**

| Condition | Notification required? |
|-----------|----------------------|
| Personal data of UK/EU individuals accessed | Yes — within 72 hours of becoming aware |
| Breach was contained before data was accessed | No (but document assessment) |
| Breach affects fewer than 250 individuals | Still required if high risk |
| Breach involves special category data | Always required |

**Decision in exercise:**
- 50 confirmed records → notify ICO within 72 hours of awareness
- Prepare notification: what data, how many individuals, likely cause, steps taken
- Contact affected individuals if high risk to their rights and freedoms

---

### T+60: Communication
**Q:** How are affected restaurants and customers notified?

**A (communication plan):**
1. Affected restaurants: direct email from CEO within 24 hours
2. Affected customers: email notification within 72 hours (or sooner if high risk)
3. ICO: notification within 72 hours of awareness
4. Public statement: only if press inquiry or regulatory requirement

**Key message:**
- Be factual; do not speculate
- State what was accessed, what was not
- State remediation steps taken
- Provide contact for affected individuals

---

### T+90: Remediation & Prevention
**Q:** What system changes are needed post-breach?

**Short-term (within 48 hours):**
1. All affected credentials rotated
2. Vulnerability patched (if identified)
3. Additional monitoring deployed for affected data paths

**Long-term:**
1. Consider field-level encryption for high-sensitivity PII (customer addresses)
2. Implement query rate limiting at DB level for bulk reads
3. Regular penetration testing engagement

---

## Gaps Identified

| Gap | Severity | Owner | Status |
|-----|----------|-------|--------|
| No DPO formally appointed (Legal L-003) | P1 | Legal | Q2 2026 |
| No automated bulk-read anomaly detection | P1 | Engineering | Sprint 2 |
| ICO notification template not yet drafted | P2 | Legal | Sprint 2 |
| Customer breach notification template not drafted | P2 | Legal | Sprint 2 |
| Field-level encryption not implemented | P3 | Engineering | Q4 2026 |

---

## Exercise Outcome

**Result:** PASS — Team identified the key decision points, regulatory obligations, and had a structured investigation procedure.

**Critical path confirmed:** 72-hour ICO window is tight. Legal must be engaged within the first hour of a confirmed breach.

**Key learning:** Engineering must NOT discuss breach details in public channels or unencrypted communications. All investigation output is potentially evidence.

---

> **Certification:** Exercise conducted 2026-03-08. Evidence for E5-T05.
