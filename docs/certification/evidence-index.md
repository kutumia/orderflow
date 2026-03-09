# Evidence Index
**E8-T03 — Certification Evidence Register**
Last updated: 2026-03-08 | Status: Certified — 100/100

---

## How to Use This Index

Each evidence item maps to one or more enterprise programme tasks (E1–E8).
Auditors can verify each item by examining the referenced file or test output.

---

## E1: Identity, Access, Tenant Isolation

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Complete API route inventory with auth classification | `docs/security/route-inventory.md` | ✅ |
| Role and access matrix | `docs/security/access-matrix.md` | ✅ |
| Service-role (supabaseAdmin) usage audit | `docs/security/service-role-audit.md` | ✅ |
| Tenant isolation regression test suite (48 tests, 9 sections) | `apps/web/src/__tests__/tenant-isolation.test.ts` | ✅ |
| Guard middleware with 3-tier role enforcement | `apps/web/src/lib/guard.ts` | ✅ |
| Auth smoke tests with curl scripts | `docs/security/auth-smoke-tests.md` | ✅ |
| Auth smoke test shell script | `scripts/auth-smoke-test.sh` | ✅ |
| PrintBridge API key hashing (SHA-256) | `packages/printbridge-core/src/index.ts` | ✅ |
| JWT re-verification against DB on every request | `apps/web/src/lib/guard.ts:84-89` | ✅ |
| Shopify nonce 15-minute TTL | `apps/web/src/app/api/shopify/callback/route.ts` | ✅ |

---

## E2: Data Security, Secrets, Trust Boundaries

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Data classification register | `docs/security/data-classification.md` | ✅ |
| Secrets register with rotation schedule | `docs/security/secrets-register.md` | ✅ |
| Standalone rotation runbook (all 8 secrets) | `docs/security/secret-rotation-runbook.md` | ✅ |
| Trust boundary map with zone diagram | `docs/security/trust-boundary-map.md` | ✅ |
| Integration trust boundaries (Stripe, Shopify, PrintBridge, Redis) | `docs/security/integration-trust-boundaries.md` | ✅ |
| CI security scanning (CodeQL + Gitleaks + audit) | `.github/workflows/security.yml` | ✅ |
| Structured logging standard (no PII in logs) | `docs/observability/logging-standard.md` | ✅ |
| Audit logger implementation | `apps/web/src/lib/audit-logger.ts` | ✅ |
| Audit logging on checkout (ORDER_CREATED) | `apps/web/src/app/api/checkout/route.ts` | ✅ |
| Audit logging on refund (REFUND_ISSUED / REFUND_FAILED) | `apps/web/src/app/api/orders/refund/route.ts` | ✅ |
| Audit logging on staff CRUD (STAFF_CREATED/UPDATED/DELETED) | `apps/web/src/app/api/staff/route.ts` | ✅ |
| Audit logging on webhook events (HMAC_INVALID, RECEIVED) | `apps/web/src/app/api/webhooks/stripe/route.ts` | ✅ |
| Validation audit — 23 endpoints, zero z.any() | `docs/security/validation-audit.md` | ✅ |
| Zod validation on all mutation endpoints | `apps/web/src/app/api/checkout/route.ts`, `hours/route.ts`, `menu-items/route.ts` | ✅ |
| HMAC verification: Stripe webhook | `apps/web/src/app/api/webhooks/stripe/route.ts` | ✅ |
| HMAC verification: Shopify webhook | `apps/web/src/app/api/shopify/webhooks/route.ts` | ✅ |
| PrintBridge webhook HMAC signing | `packages/printbridge-core/src/index.ts` (fireWebhook) | ✅ |
| Timing-safe cron secret comparison | `apps/web/src/app/api/cron/*/route.ts` | ✅ |
| .env.example with all required variables | `.env.example` | ✅ |

---

## E3: Workflow Integrity, Idempotency

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Order lifecycle state machine diagram | `docs/workflows/order-lifecycle.md` | ✅ |
| Print job state machine diagram | `docs/workflows/order-lifecycle.md#print-job-state-machine` | ✅ |
| Idempotency model documentation | `docs/reliability/idempotency-model.md` | ✅ |
| Idempotency key implementation | `apps/web/src/lib/idempotency.ts` | ✅ |
| Idempotency integrated into checkout handler | `apps/web/src/app/api/checkout/route.ts:42-50` | ✅ |
| Correlation ID implementation | `apps/web/src/lib/correlation.ts` | ✅ |
| Correlation IDs wired into checkout | `apps/web/src/app/api/checkout/route.ts` | ✅ |
| Correlation IDs wired into webhooks | `apps/web/src/app/api/webhooks/stripe/route.ts` | ✅ |
| Idempotency migration | `supabase/migrations/026_idempotency_keys.sql` | ✅ |
| Duplicate event tests (20 tests) | `apps/web/src/__tests__/idempotency.test.ts` | ✅ |
| Shopify order dedup (ON CONFLICT) | `apps/web/src/app/api/shopify/orders/route.ts` | ✅ |
| Print job atomic status transition | `packages/printbridge-core/src/index.ts` | ✅ |
| Webhook replay operator script | `scripts/replay-webhook.ts` | ✅ |
| Print job retry operator script | `scripts/retry-print-job.ts` | ✅ |

---

## E4: Observability and Telemetry

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Structured logging standard | `docs/observability/logging-standard.md` | ✅ |
| Logger implementation | `apps/web/src/lib/logger.ts` | ✅ |
| Audit logger implementation | `apps/web/src/lib/audit-logger.ts` | ✅ |
| Dashboard specifications (4 dashboards) | `docs/observability/dashboards.md` | ✅ |
| Alert policy with severity model (25+ alerts) | `docs/observability/alert-policy.md` | ✅ |
| Enhanced health check endpoint | `apps/web/src/app/api/health/route.ts` | ✅ |
| Health check: DB latency check | `apps/web/src/app/api/health/route.ts:checkDatabase()` | ✅ |
| Health check: env var validation | `apps/web/src/app/api/health/route.ts:checkEnvironment()` | ✅ |
| Vercel Log Drain configuration | `docs/observability/logging-standard.md#vercel-log-drain` | ✅ |

---

## E5: Recoverability and Incident Response

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Incident severity model (P0-P3) | `docs/ops/incident-severity.md` | ✅ |
| API error rate runbook | `docs/ops/runbooks/api-errors.md` | ✅ |
| Database incident runbook | `docs/ops/runbooks/database-incident.md` | ✅ |
| Security incident runbook | `docs/ops/runbooks/security-incident.md` | ✅ |
| PrintBridge incident runbook | `docs/ops/runbooks/printbridge-incident.md` | ✅ |
| Backup and restore procedures | `docs/ops/backup-restore.md` | ✅ |
| RTO target: 2 hours | `docs/ops/backup-restore.md#recovery-objectives` | ✅ |
| RPO target: 1 hour | `docs/ops/backup-restore.md#recovery-objectives` | ✅ |
| GDPR breach notification procedure | `docs/ops/runbooks/security-incident.md#regulatory-obligations` | ✅ |
| Operator script: inspect order + audit trail | `scripts/inspect-order.ts` | ✅ |
| Operator script: inspect tenant config | `scripts/inspect-tenant.ts` | ✅ |
| Operator script: disable integration | `scripts/disable-integration.ts` | ✅ |
| Tabletop drill: payment outage | `docs/ops/drills/drill-01-payment-outage.md` | ✅ |
| Tabletop drill: database incident | `docs/ops/drills/drill-02-database-incident.md` | ✅ |
| Tabletop drill: security / credential compromise | `docs/ops/drills/drill-03-security-incident.md` | ✅ |
| Tabletop drill: PrintBridge mass failure | `docs/ops/drills/drill-04-printbridge-failure.md` | ✅ |
| Tabletop drill: data breach response | `docs/ops/drills/drill-05-data-breach.md` | ✅ |

---

## E6: Release Engineering

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Environment model (Dev/Preview/Staging/Prod) | `docs/release/environment-model.md` | ✅ |
| CI pipeline with lint + typecheck + test + build | `.github/workflows/ci.yml` | ✅ |
| Security scanning CI pipeline | `.github/workflows/security.yml` | ✅ |
| Release checklist | `docs/release/release-checklist.md` | ✅ |
| Rollback runbook (< 5 min target) | `docs/release/rollback-runbook.md` | ✅ |
| Migration safety standard | `docs/release/migration-safety.md` | ✅ |
| Expand-contract pattern documented | `docs/release/rollback-runbook.md#migration-safety` | ✅ |
| Feature flag policy + implementation pattern | `docs/release/feature-flags.md` | ✅ |
| Coverage threshold ≥ 80% | `apps/web/jest.config.js` | ✅ |

---

## E7: Resilience, Load, Failure

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Dependency audit (3-tier: critical/important/non-critical) | `docs/architecture/dependency-audit.md` | ✅ |
| Test taxonomy (8 layers) | `docs/testing/test-strategy.md` | ✅ |
| Resilience scenario suite (11 scenarios, all PASS) | `docs/testing/scenario-matrix.md` | ✅ |
| k6 load test script | `k6/load-test.js` | ✅ |
| k6 soak test (2-hour, 50% load) | `k6/soak-test.js` | ✅ |
| k6 resilience scenarios (auth, rate limit, payload) | `k6/resilience-scenarios.js` | ✅ |
| Performance test report (p95 < 500ms confirmed) | `docs/testing/performance-report.md` | ✅ |
| Degradation behaviour proof (10 failure scenarios) | `docs/testing/degradation-report.md` | ✅ |
| Chaos drill report (4 drills, all PASS) | `docs/testing/chaos-drills.md` | ✅ |
| Redis fallback implementation | `apps/web/src/lib/rate-limit.ts` | ✅ |
| Rate limit fallback test | `apps/web/src/__tests__/rate-limit.test.ts` | ✅ |

---

## E8: Certification Pack

| Evidence | File / Location | Verified |
|---------|-----------------|---------|
| Readiness dossier | `docs/certification/readiness-dossier.md` | ✅ |
| Risk register (10 risks, none critical) | `docs/certification/risk-register.md` | ✅ |
| Evidence index (this document) | `docs/certification/evidence-index.md` | ✅ |
| Known limitations (12 items, all accepted) | `docs/certification/known-limitations.md` | ✅ |
| Final review pack (exam results, sign-off) | `docs/certification/final-review-pack.md` | ✅ |
| Enterprise scorecard (100/100) | `enterprise-scorecard.md` | ✅ |

---

## Test Coverage Summary

| Test Suite | File | Test Count |
|-----------|------|-----------|
| Rate limit tests | `__tests__/rate-limit.test.ts` | 12 |
| Security tests | `__tests__/security.test.ts` | 14 |
| PrintBridge tests | `__tests__/printbridge.test.ts` | 4 |
| Tenant isolation tests | `__tests__/tenant-isolation.test.ts` | 48 |
| Idempotency tests | `__tests__/idempotency.test.ts` | 20 |
| Checkout tests | `__tests__/checkout.test.ts` | ~8 |
| Webhook tests | `__tests__/webhook.test.ts` | ~6 |
| Hours tests | `__tests__/hours.test.ts` | ~4 |
| **Total** | — | **116+** |

---

## Open P0/P1 Items

**None.** All known P0 and P1 issues resolved.

| Category | Open P0 | Open P1 |
|----------|---------|---------|
| Auth/AuthZ | 0 | 0 |
| Tenant Isolation | 0 | 0 |
| Payments | 0 | 0 |
| Orders/Refunds | 0 | 0 |
| Print Workflows | 0 | 0 |
| Deployment/Rollback | 0 | 0 |

> **Certification:** Evidence index verified 2026-03-08. All evidence items confirmed present and current. Score: 100/100.
