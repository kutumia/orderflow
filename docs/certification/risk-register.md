# Risk Register
**E8-T02 — Enterprise Risk Register**
Last updated: 2026-03-08 | Status: Certified

---

## Risk Rating Matrix

| Probability | Impact | Risk Score |
|-------------|--------|-----------|
| High (3) | High (3) | 9 — Critical |
| High (3) | Medium (2) | 6 — High |
| Medium (2) | High (3) | 6 — High |
| Medium (2) | Medium (2) | 4 — Medium |
| Low (1) | High (3) | 3 — Medium |
| Low (1) | Medium (2) | 2 — Low |
| Any | Low (1) | 1 — Low |

---

## Risk Register

### R-001: Supabase Single-Region Failure
| Attribute | Value |
|-----------|-------|
| Category | Infrastructure |
| Probability | Low (1) — Supabase Pro has 99.9% SLA |
| Impact | High (3) — Complete service outage |
| Risk Score | 3 — Medium |
| Owner | Engineering |
| **Mitigation** | Supabase handles HA within region. Incident runbook documented. Recovery target 2hr. |
| **Residual Risk** | No multi-region DB failover. Acceptable given SLA. |
| Review Date | Quarterly |

---

### R-002: Stripe API Unavailability
| Attribute | Value |
|-----------|-------|
| Category | Third-party |
| Probability | Low (1) — Stripe 99.99% SLA |
| Impact | High (3) — No new orders can be paid |
| Risk Score | 3 — Medium |
| Owner | Engineering |
| **Mitigation** | Stripe handles HA. Monitor Stripe status page. Alert policy in place. |
| **Residual Risk** | Pending orders in Stripe dashboard remain; recoverable after outage. |
| Review Date | Quarterly |

---

### R-003: API Key Compromise (PrintBridge)
| Attribute | Value |
|-----------|-------|
| Category | Security |
| Probability | Low (1) |
| Impact | Medium (2) — Tenant print jobs accessible to attacker |
| Risk Score | 2 — Low |
| Owner | Security |
| **Mitigation** | API keys are SHA-256 hashed in DB. Raw keys never stored. Tenant-scoped queries prevent cross-tenant access even with valid key. Keys can be revoked instantly. |
| **Residual Risk** | Attacker with stolen key can create print jobs for that tenant only. No PII exposed. |
| Review Date | Semi-annual |

---

### R-004: Session Token Theft / JWT Attack
| Attribute | Value |
|-----------|-------|
| Category | Security |
| Probability | Low (1) |
| Impact | High (3) — Attacker accesses restaurant data |
| Risk Score | 3 — Medium |
| Owner | Security |
| **Mitigation** | JWT re-verified against DB on every guard call (restaurant_id match). 15-minute JWT revalidation. Compromised user can be deleted from DB (auto-invalidates session). HTTPS enforced. |
| **Residual Risk** | 15-minute window of valid JWT after DB deletion. Acceptable. |
| Review Date | Semi-annual |

---

### R-005: GDPR Non-Compliance (Data Breach)
| Attribute | Value |
|-----------|-------|
| Category | Regulatory |
| Probability | Low (1) |
| Impact | High (3) — ICO fine up to 4% global revenue; reputational damage |
| Risk Score | 3 — Medium |
| Owner | DPO / Legal |
| **Mitigation** | GDPR export/delete endpoints implemented. Data classification documented. Breach notification runbook in place (72hr ICO window). PII masked in logs. |
| **Residual Risk** | Dependent on DPO appointment and privacy policy completeness (non-technical). |
| Review Date | Annual |

---

### R-006: Dependency Vulnerability (Supply Chain)
| Attribute | Value |
|-----------|-------|
| Category | Security |
| Probability | Medium (2) |
| Impact | Medium (2) — Code execution or data access via compromised package |
| Risk Score | 4 — Medium |
| Owner | Engineering |
| **Mitigation** | `npm audit` in CI; blocks on critical vulnerabilities. Secret scanning via Gitleaks. CodeQL SAST analysis. Weekly dependency review. |
| **Residual Risk** | Zero-day vulnerabilities before npm audit detection. |
| Review Date | Weekly (automated) |

---

### R-007: Cron Job Failure (Email / Print Queue)
| Attribute | Value |
|-----------|-------|
| Category | Operational |
| Probability | Medium (2) |
| Impact | Low (1) — Emails delayed; print queue backed up |
| Risk Score | 2 — Low |
| Owner | Engineering |
| **Mitigation** | Cron jobs are idempotent (re-run safe). Alert fires on non-200 response. Next scheduled run recovers automatically. |
| **Residual Risk** | Up to 1 scheduled interval (30min) of delayed processing. |
| Review Date | Monthly |

---

### R-008: Shopify OAuth State/CSRF Attack
| Attribute | Value |
|-----------|-------|
| Category | Security |
| Probability | Low (1) |
| Impact | Medium (2) — Attacker links their Shopify store to victim restaurant |
| Risk Score | 2 — Low |
| Owner | Security |
| **Mitigation** | Nonce stored in DB with 15-minute TTL. State parameter validated on callback. Ownership check: session's restaurantId must match. |
| **Residual Risk** | Low. Multiple independent checks in place. |
| Review Date | Annual |

---

### R-009: Rate Limit Bypass (In-Memory Fallback)
| Attribute | Value |
|-----------|-------|
| Category | Security / Availability |
| Probability | Medium (2) — Upstash outage triggers fallback |
| Impact | Low (1) — Rate limits not globally enforced across Vercel instances |
| Risk Score | 2 — Low |
| Owner | Engineering |
| **Mitigation** | Upstash Redis preferred. In-memory fallback per function instance (still effective per-VU). Vercel function instances naturally provide some isolation. |
| **Residual Risk** | Distributed DDoS can bypass per-instance rate limit. Vercel WAF is the outer defence. |
| Review Date | Semi-annual |

---

### R-010: Secret Rotation Failure
| Attribute | Value |
|-----------|-------|
| Category | Operational / Security |
| Probability | Low (1) |
| Impact | Medium (2) — Stale credentials, potential for compromise |
| Risk Score | 2 — Low |
| Owner | Engineering |
| **Mitigation** | Secrets register with rotation schedule documented. Automated reminder via alert policy. Manual process with checklist. |
| **Residual Risk** | Process-dependent; requires human discipline. |
| Review Date | Per rotation schedule |

---

## Risk Summary

| Score | Count | Risks |
|-------|-------|-------|
| Critical (9) | 0 | — |
| High (6) | 0 | — |
| Medium (3-4) | 5 | R-001, R-002, R-004, R-005, R-006 |
| Low (1-2) | 5 | R-003, R-007, R-008, R-009, R-010 |

**No critical or high risks identified.** All residual risks are accepted at Medium or Low.

> **Certification:** Risk register reviewed and accepted 2026-03-08. No open critical risks.
