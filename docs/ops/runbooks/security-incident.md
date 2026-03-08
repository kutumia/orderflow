# Runbook: Security Incident
**E5-T02 — Security Incident Response**
Severity: P0 (breach) / P1 (suspected breach)

---

## Trigger Conditions

- Confirmed unauthorised data access
- Compromised credentials (API key, admin password)
- GDPR breach (customer PII exposed)
- Unusual admin activity pattern
- Successful injection attack detected in logs

---

## Immediate Actions (0–30 minutes)

### STOP THE BLEEDING FIRST

1. **Revoke compromised credential immediately**
   - API key: Delete from `pb_api_keys` table in Supabase
   - Admin password: Force reset via Supabase Auth
   - Stripe key: Roll in Stripe Dashboard
   - NextAuth secret: Rotate (invalidates all sessions)

2. **Block suspected attacker IP** (if known)
   - Add to Vercel WAF block list (if available)
   - Or add temporary middleware IP block

3. **Preserve evidence**
   ```bash
   # Export Vercel logs for the incident window
   # Download Supabase audit logs
   # Screenshot any anomalous dashboard readings
   ```

4. **Do not** attempt to clean up data or cover tracks — preserve everything for forensics

---

## Assessment (30–60 minutes)

### 1. Determine scope

- Which tenant(s) affected?
- Which data accessed? (Orders? Customer PII? Payment refs?)
- Time window of compromise
- Entry point (API key, session, SQL injection, etc.)

```sql
-- Supabase: Check recent admin operations
SELECT * FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;
```

### 2. Assess GDPR obligations

If customer PII (name, email, phone, address) was accessed by unauthorised party:
- **72-hour GDPR breach notification** clock starts from when you KNEW
- Notify Data Protection Officer / legal counsel IMMEDIATELY
- Prepare breach notification for ICO (UK) or relevant supervisory authority

### 3. Notify affected parties

- **Platform admin:** Immediate Slack DM to CTO
- **Affected restaurant owners:** Email within 4 hours if their data exposed
- **Affected customers:** If card data exposed (unlikely — Stripe handles), coordinate with Stripe

---

## Communication (Confidential)

**Do NOT** post details in public Slack channels. Use DMs or private incident channel.

**CTO notification (immediate DM):**
```
CONFIDENTIAL — Security Incident
Time detected: HH:MM UTC
Nature: [Unauthorised access / credential compromise / etc.]
Data at risk: [PII / API keys / Order data]
Immediate actions taken: [List]
Assessing scope. Will update in 30 minutes.
```

---

## Containment Checklist

- [ ] Compromised credential revoked
- [ ] Attacker access removed
- [ ] Evidence preserved (logs downloaded)
- [ ] Affected systems identified
- [ ] GDPR obligation assessed
- [ ] CTO notified
- [ ] DPO/legal notified (if PII exposed)
- [ ] ICO notification prepared (if required, 72hr deadline)
- [ ] Affected restaurants notified
- [ ] Post-mortem scheduled

---

## Root Cause Investigation

After containment:

1. Audit log review: `audit_log` table in Supabase
2. Vercel function logs for the incident window
3. Check for: SQL injection, IDOR, session token theft, API key exposure in logs
4. Review git history for accidentally committed secrets: `git log -S "sk_live" --all`
5. Engage external security firm if needed (> P0 scope)

---

## Regulatory Obligations

| Event | Obligation | Deadline |
|-------|-----------|---------|
| UK GDPR breach (PII accessed) | Notify ICO | 72 hours from awareness |
| UK GDPR breach (high risk) | Notify affected individuals | Without undue delay |
| PCI-DSS breach (card data) | Notify Stripe + card brands | Immediately |
| SOC2 breach (if certified) | Notify auditors | Per contract |
