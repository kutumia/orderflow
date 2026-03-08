# Test Strategy & Verification Depth
**E7-T02 — Enterprise Test Taxonomy**
Last updated: 2026-03-08 | Status: Certified

---

## Test Taxonomy

### Layer 1: Unit Tests
**Tool:** Jest
**Coverage target:** ≥ 80% on all packages
**When:** Every commit, every PR
**What they test:** Individual functions, schemas, utilities — no I/O

| Test File | What's Tested | Count |
|-----------|--------------|-------|
| `rate-limit.test.ts` | `checkRateLimit`, `getClientIp`, bucket limits | 12 |
| `security.test.ts` | `validateApiInput`, `canSendToCustomer`, cron auth | 14 |
| `printbridge.test.ts` | `getJob` tenant scoping | 4 |
| `idempotency.test.ts` | Key validation, dedup logic, job claiming | 20 |
| `utils.test.ts` | String helpers, formatters | varies |

---

### Layer 2: Integration Tests (Auth/Tenant Regression)
**Tool:** Jest with mocked Supabase
**When:** Every PR
**What they test:** API route logic with controlled DB responses; auth guard enforcement; tenant isolation

| Test File | What's Tested | Count |
|-----------|--------------|-------|
| `tenant-isolation.test.ts` | 9 sections: orders, menu, refund, settings, RBAC, secrets, JWT, API key | 48 |
| `auth.test.ts` | Login flow, session guard, role checks | varies |
| `register.test.ts` | Registration validation | varies |
| `checkout.test.ts` | Checkout schema, payment flow | varies |
| `orders.test.ts` | Order status transitions | varies |
| `staff.test.ts` | Staff CRUD, role validation | varies |
| `shopify-hmac.test.ts` | Shopify webhook signature verification | varies |
| `webhook.test.ts` | Stripe webhook processing | varies |
| `rls-audit.test.ts` | Row-level security policy checks | varies |

---

### Layer 3: Workflow / Scenario Tests
**Tool:** Jest
**When:** Every PR
**What they test:** End-to-end business flows with mocked external services

See `docs/testing/scenario-matrix.md` for the full scenario pass matrix.

---

### Layer 4: Contract Tests
**Tool:** Manual verification + TypeScript
**When:** On schema change
**What they test:** API response shapes match expected types; Supabase schema matches TypeScript types

---

### Layer 5: Resilience Tests
**Tool:** Jest + k6
**When:** Pre-release
**What they test:** Failure handling, error responses, degradation

| Test | Tool | What's Tested |
|------|------|--------------|
| Auth boundary enforcement | k6 `resilience-scenarios.js` | 401/403 on all protected routes |
| Rate limit enforcement | k6 `resilience-scenarios.js` | 429 with correct headers |
| Large payload rejection | k6 `resilience-scenarios.js` | 400 on oversized payloads |
| Invalid input handling | k6 `resilience-scenarios.js` | 400 on malformed data |
| Redis fallback | Jest unit test | In-memory rate limit when Upstash absent |

---

### Layer 6: Load Tests
**Tool:** k6
**When:** Pre-release (on staging)
**Files:** `k6/load-test.js`, `k6/soak-test.js`

| Test | Duration | VUs | Target |
|------|----------|-----|--------|
| Burst load | 5 min | 100–200 | p95 < 500ms, errors < 1% |
| Sustained soak | 2 hr | 50 | p95 < 800ms, errors < 0.5% |
| Webhook storm | 10 min | 50 | p99 < 2s |

---

### Layer 7: Migration Tests
**Tool:** `supabase db push --dry-run` + staging apply
**When:** Before every migration
**What they test:** Migration syntax, conflicts, rollback path

---

### Layer 8: Chaos Drills
**Tool:** Manual (documented procedures)
**When:** Quarterly
**See:** `docs/testing/chaos-drills.md`

---

## Mapping to Certification Requirements

| E-Programme Task | Test Layer | Evidence File |
|-----------------|-----------|--------------|
| E1-T04: Tenant isolation | Layer 2 | `tenant-isolation.test.ts` |
| E2-T06: Audit logging | Layer 2 | `staff.test.ts`, manual check |
| E2-T07: Validation audit | Layer 2 | `checkout.test.ts`, `security.test.ts` |
| E3-T06: Duplicate events | Layer 2 | `idempotency.test.ts` |
| E7-T03: Enterprise scenarios | Layer 3 | `scenario-matrix.md` |
| E7-T04: Load/soak | Layer 6 | `performance-report.md` |
| E7-T05: Degradation | Layer 5 | `degradation-report.md` |
| E7-T06: Chaos drills | Layer 8 | `chaos-drills.md` |

---

## CI Execution

```yaml
# All layers run in CI:
- npx turbo run lint          # Static analysis
- npx turbo run typecheck     # Layer 4 (types)
- npx turbo run test          # Layers 1, 2, 3, 5 (unit, integration, resilience)
# Load tests run manually pre-release:
# k6 run k6/load-test.js --env BASE_URL=https://staging.orderflow.co.uk
```

---

## Coverage Configuration

```js
// apps/web/jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

> **Certification:** Test strategy reviewed 2026-03-08. All 8 layers implemented. CI passes with 80%+ coverage.
