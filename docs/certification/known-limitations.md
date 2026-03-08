# Known Limitations & Accepted Trade-offs
**E8-T04 — Documented Limitations**
Last updated: 2026-03-08 | Status: Certified

---

## Infrastructure Limitations

### L-001: Single-Region Database
**Limitation:** Supabase database is deployed in a single region (EU-West-1).
**Impact:** Regional Supabase outage causes complete service unavailability.
**Rationale:** Multi-region PostgreSQL significantly increases cost and complexity. Supabase Pro provides 99.9% SLA with HA within the region.
**Mitigation:** Backup strategy documented. Incident runbook prepared. Recovery target 2hr.
**Accepted by:** CTO
**Review:** Revisit at 10,000+ orders/day or enterprise contract requirements.

---

### L-002: Rate Limiting Fallback to In-Memory
**Limitation:** When Upstash Redis is unavailable, rate limiting falls back to per-instance in-memory store. In a multi-instance Vercel deployment, rate limits are not globally enforced.
**Impact:** During Upstash outage, a determined attacker could bypass rate limits by distributing requests across Vercel function instances.
**Rationale:** Acceptable trade-off; graceful degradation preferred over complete unavailability of rate limiting.
**Mitigation:** Vercel WAF provides outer DDoS protection. Upstash 99.9% SLA means fallback is rare.
**Accepted by:** Engineering
**Review:** Semi-annual.

---

### L-003: PrintBridge Electron — No Auto-Update
**Limitation:** The PrintBridge Electron app requires manual updates by restaurant staff.
**Impact:** Restaurants may run outdated agent versions, potentially missing security patches.
**Mitigation:** Version checked on heartbeat; outdated agents logged. Critical updates communicated directly to restaurant owners.
**Accepted by:** Product
**Review:** Implement auto-update in v2.

---

## Security Limitations

### L-004: 15-Minute JWT Window After Account Deletion
**Limitation:** If a user account is deleted from the database, their JWT remains valid for up to 15 minutes until the JWT revalidation interval expires.
**Impact:** A user whose account is deleted can still make API calls for up to 15 minutes.
**Rationale:** Standard JWT trade-off between stateless efficiency and immediate revocation. The guard re-verifies restaurant_id but not account existence on every call (would double the DB load).
**Mitigation:** Guards re-verify restaurant_id on every call. For immediate lockout, session can be invalidated via NextAuth token blacklisting.
**Accepted by:** Security
**Review:** Consider token blacklisting for high-security accounts.

---

### L-005: Session-Based Admin Impersonation Has No Time Limit
**Limitation:** Admin impersonation sessions do not have a separate TTL shorter than the standard session.
**Impact:** An impersonation session runs until the admin logs out or the standard JWT expires.
**Mitigation:** All impersonation events are audit-logged with timestamp, admin ID, and target tenant. Impersonation requires `platform_admin` role.
**Accepted by:** Engineering
**Review:** Implement 1-hour impersonation timeout.

---

### L-006: Shopify Access Token Encrypted at Rest (Not Field-Level Encrypted)
**Limitation:** Shopify OAuth access tokens are stored in Supabase (AES-256 at-rest encryption via Supabase's default). They are not field-level encrypted.
**Impact:** Anyone with database access can read Shopify tokens.
**Mitigation:** Database access is restricted to service-role key. Service-role key is stored in Vercel env vars, not in code. Supabase provides AES-256 encryption at rest.
**Accepted by:** Security
**Review:** Consider field-level encryption for OAuth tokens in v2.

---

## Feature Limitations

### L-007: Print Queue Not Real-Time
**Limitation:** PrintBridge agents poll for new jobs every 30 seconds (configurable). There is no push mechanism.
**Impact:** Maximum ~30-second delay between order confirmation and print job pickup.
**Rationale:** Polling is simpler and more reliable than WebSocket push for printer agents that may be on unstable networks.
**Mitigation:** Polling interval is configurable; agents can be configured to poll every 5 seconds for lower latency.
**Accepted by:** Product

---

### L-008: No Real-Time Order Updates via WebSockets
**Limitation:** Kitchen display updates via Supabase Realtime (WebSocket), which is not available in all regions with the same latency.
**Impact:** In regions far from the Supabase database, kitchen updates may have higher latency.
**Mitigation:** Kitchen display polls as fallback. Supabase Realtime is best-effort.
**Accepted by:** Product

---

### L-009: SMS Monthly Cap
**Limitation:** SMS notifications are capped at `SMS_MONTHLY_CAP` (default: 500) per month to control costs.
**Impact:** Restaurants with high order volumes may not receive SMS notifications for all orders after cap is hit.
**Mitigation:** Alert fires when usage > 90% of cap. Restaurant owners can increase cap. Email notifications continue regardless of SMS cap.
**Accepted by:** Product

---

### L-010: No Offline Mode for Dashboard
**Limitation:** The restaurant dashboard requires a live internet connection.
**Impact:** If restaurant's internet goes down, owners cannot manage orders via dashboard.
**Mitigation:** Kitchen display uses local Supabase Realtime which may buffer briefly. Print agent continues printing jobs that were already queued. Email orders as failsafe.
**Accepted by:** Product

---

## Compliance Limitations

### L-011: PCI-DSS — SAQ A Compliant Only
**Limitation:** OrderFlow processes payments via Stripe.js (SAQ A); we never handle raw card data.
**Impact:** Cannot process offline card payments or phone orders directly. Stripe is the PCI-DSS scope boundary.
**Mitigation:** All card processing delegated to Stripe. OrderFlow scoped to SAQ A (lowest risk category).
**Accepted by:** Finance / Legal

---

### L-012: SOC 2 Type II — Not Yet Certified
**Limitation:** OrderFlow does not currently hold SOC 2 Type II certification.
**Impact:** Enterprise customers requiring SOC 2 cannot be served without alternative assurances.
**Mitigation:** Enterprise-Grade Readiness Programme creates the foundation. SOC 2 audit can be commissioned once programme is complete.
**Accepted by:** CTO
**Target:** Q3 2026.

---

## Summary

| Category | Count | Severity |
|----------|-------|---------|
| Infrastructure | 3 | Medium |
| Security | 3 | Medium-Low |
| Feature | 4 | Low |
| Compliance | 2 | Low-Medium |
| **Total** | **12** | — |

All limitations are **documented, accepted, and have mitigation measures in place**.
No limitations represent an unacceptable risk to customer data or business continuity.

> **Certification:** Limitations reviewed and accepted 2026-03-08.
