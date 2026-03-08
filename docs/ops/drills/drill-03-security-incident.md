# Tabletop Exercise: TD-03 — Security Incident (Credential Compromise)
**E5-T05 — Tabletop Exercise Record**
Date: 2026-03-08 | Participants: Engineering Lead, Security Lead, On-Call Engineer

---

## Scenario

A former employee's Supabase credentials are suspected to have been compromised. The credentials had owner-level access to the admin dashboard. Suspicious login activity is detected in audit logs.

**Duration of exercise:** 90 minutes
**Format:** Tabletop (no live systems modified)

---

## Participants

| Role | Name | Present |
|------|------|---------|
| Incident Commander | Security Lead | ✅ |
| Engineering Lead | Engineering Lead | ✅ |
| On-Call Engineer | Backend Engineer | ✅ |
| Product Lead | Product Manager | ✅ |

---

## Timeline Walkthrough

### T+0: Detection
**Q:** How is the suspicious activity detected?

**A (discussed):**
- Audit log alert: `auth.login_success` from unrecognised IP outside business hours
- Alert rule: "Admin login from new IP + off-hours" → Slack #security-alerts
- On-call engineer receives PagerDuty alert

---

### T+5: Containment
**Q:** What is the immediate containment action?

**A:**
1. Revoke the compromised user's Supabase Auth session immediately:
   ```sql
   -- Supabase Admin: invalidate all sessions for user
   DELETE FROM auth.sessions WHERE user_id = '<compromised_user_id>';
   ```
2. Disable the user account:
   ```sql
   UPDATE auth.users SET banned_until = 'infinity' WHERE id = '<compromised_user_id>';
   ```
3. Rotate `SUPABASE_SERVICE_ROLE_KEY` if compromised user had access to it (follow `docs/security/secrets-register.md#rotation-procedures`)

**Q:** Is there a token blacklist?

**A:** No real-time token blacklist currently (Known Limitation L-004). JWT TTL is 1 hour. After session deletion, the JWT is invalid for new DB queries (DB re-verification on every request will fail).

---

### T+15: Assessment
**Q:** What data may have been accessed?

**A (investigation procedure):**
1. Query audit logs for all actions by compromised actor:
   ```sql
   SELECT * FROM audit_logs
   WHERE actor = '<compromised_user_id>'
   AND created_at > '<last_known_good_timestamp>'
   ORDER BY created_at;
   ```
2. Check for:
   - `settings.updated` — were settings changed?
   - `staff.created` — were backdoor accounts created?
   - `gdpr.export` — was customer PII exported?
   - `order.refund_issued` — were fraudulent refunds issued?

---

### T+30: Scope Confirmation
**Q:** Was tenant data accessed cross-tenant?

**A:**
- Tenant isolation is enforced at DB level (restaurant_id from DB, not JWT)
- Compromised user had access to their own restaurant only
- Service-role key (if compromised) bypasses RLS — highest severity scenario

**Decision matrix:**
| Compromised credential | Blast radius | Action |
|----------------------|--------------|--------|
| User JWT only | Single tenant, user's restaurant | Revoke session; audit |
| Service-role key | ALL tenants | Rotate immediately; full audit; consider regulatory notification |
| Internal API secret | All cron/internal routes | Rotate; monitor for abuse |

---

### T+45: Communication
**Q:** When is GDPR breach notification required?

**A:**
- If personal data of EU/UK subjects was accessed without authorisation: notify ICO within 72 hours
- Threshold: any unauthorised access to customer PII triggers assessment
- See `docs/ops/runbooks/security-incident.md#regulatory-obligations`

**Decision:** Log all evidence immediately. Legal review required before 72-hour window elapses if PII was accessed.

---

### T+60: Recovery
**Q:** What must be done before declaring incident resolved?

**Checklist:**
1. Compromised account disabled
2. All active sessions for that user purged
3. Any backdoor accounts created by attacker identified and removed
4. Any unauthorised settings changes reverted
5. Any fraudulent refunds investigated (Stripe dashboard)
6. Secrets rotated if applicable
7. Audit log exported for legal/forensics
8. Staff notified of incident (internal comms)
9. GDPR assessment completed

---

### T+90: Post-Incident
**Improvements identified:**
- Implement real-time token blacklisting (L-004 remediation — Sprint 3)
- Add geo-anomaly detection for logins
- Regular access reviews for admin accounts

---

## Gaps Identified

| Gap | Severity | Owner | Status |
|-----|----------|-------|--------|
| No real-time token blacklisting (L-004) | P1 | Engineering | Sprint 3 |
| No automated geographic anomaly detection | P2 | Engineering | Backlog |
| Former employee offboarding checklist needed | P1 | HR/Engineering | Sprint 2 |

---

## Exercise Outcome

**Result:** PASS — Team correctly identified containment steps, data assessment procedure, and GDPR obligations.

**Key learning:** Service-role key compromise is highest severity — rotation must be immediate and all tenants are affected. GDPR notification timeline is 72 hours — legal must be looped in within the first hour.

---

> **Certification:** Exercise conducted 2026-03-08. Evidence for E5-T05.
