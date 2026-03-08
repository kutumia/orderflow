# Environment Model
**E6-T01 — Deployment Environments and Promotion Policy**
Last updated: 2026-03-08 | Status: Certified

---

## Environment Topology

```
Developer → Feature Branch → Preview → Staging → Production
               (local)        (Vercel)   (Vercel)   (Vercel)
```

### Development (local)

| Property | Value |
|----------|-------|
| URL | `http://localhost:3000` |
| Database | Supabase local dev (`supabase start`) |
| Auth | Local Supabase Auth |
| Stripe | Test mode keys |
| Print | Simulated (no real printers) |
| Vercel ENV | `VERCEL_ENV=development` |
| Purpose | Active development, debugging |

**Config:** `.env.local` (not committed; from `.env.example` template)

---

### Preview (Vercel Preview Deployments)

| Property | Value |
|----------|-------|
| URL | `https://<branch>-orderflow.vercel.app` |
| Database | Shared staging Supabase project |
| Auth | Staging Supabase Auth |
| Stripe | Test mode keys |
| Print | Test tenant only |
| Vercel ENV | `VERCEL_ENV=preview` |
| Purpose | PR review, QA testing |

**Config:** Vercel project environment variables (Preview scope)
**Trigger:** Automatic on any branch push / PR creation

---

### Staging

| Property | Value |
|----------|-------|
| URL | `https://staging.orderflow.co.uk` |
| Database | Staging Supabase project (separate from prod) |
| Auth | Staging Supabase Auth |
| Stripe | Test mode keys |
| Print | Full PrintBridge stack (test mode) |
| Vercel ENV | `VERCEL_ENV=preview` + `STAGING=true` |
| Purpose | Integration testing, migration validation, load testing |

**Config:** Vercel project environment variables (Preview scope with `STAGING=true`)
**Trigger:** Merge to `staging` branch or manual promotion

**Migration policy:** All migrations MUST pass staging before production.

---

### Production

| Property | Value |
|----------|-------|
| URL | `https://orderflow.co.uk` |
| Database | Production Supabase project |
| Auth | Production Supabase Auth |
| Stripe | Live mode keys |
| Print | Full PrintBridge stack (live) |
| Vercel ENV | `VERCEL_ENV=production` |
| Purpose | Live customer traffic |

**Config:** Vercel project environment variables (Production scope)
**Trigger:** Merge to `main` branch after passing all CI gates

---

## Promotion Gates

### Feature Branch → Preview
- [ ] Branch created from latest `main`
- [ ] CI passing (lint, typecheck, test, build)
- [ ] PR created with description

### Preview → Staging
- [ ] PR approved by 1 reviewer
- [ ] All CI gates green
- [ ] Security scan passing

### Staging → Production
- [ ] All CI gates green
- [ ] Security scan passing
- [ ] Migration tested on staging
- [ ] Release checklist completed
- [ ] Manual smoke test on staging
- [ ] Pre-migration backup created (if migration included)

---

## Environment Variable Matrix

| Variable | Dev | Preview | Staging | Production |
|----------|-----|---------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Local | Staging | Staging | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Local | Staging | Staging | Production |
| `STRIPE_SECRET_KEY` | `sk_test_*` | `sk_test_*` | `sk_test_*` | `sk_live_*` |
| `NEXTAUTH_URL` | `http://localhost:3000` | Preview URL | `https://staging.orderflow.co.uk` | `https://orderflow.co.uk` |
| `NODE_ENV` | development | production | production | production |

---

## Feature Flags

Feature flags allow shipping code to production before features are live.
Implemented via environment variables + conditional logic.

**Policy:**
- Flags default to `false` (feature off)
- Enable per-environment via `FEATURE_<NAME>=true`
- Flags documented in `docs/release/feature-flags.md`
- Remove flag within 2 sprints of full rollout

> **Certification:** Environment model reviewed 2026-03-08. Staging → Production gates enforced via CI.
