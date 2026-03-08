# Release Checklist
**E6-T03 — Pre-Release Verification**
Last updated: 2026-03-08 | Status: Certified

---

## How to Use This Checklist

Copy this checklist into the release PR description or a Slack thread.
Check each item before promoting to production.
If ANY item fails, block the release and address the gap.

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All CI checks green (lint, typecheck, test, build)
- [ ] Security scan passing (no new critical vulnerabilities)
- [ ] Code review approved by ≥ 1 reviewer
- [ ] No `console.log` or debug code in production paths
- [ ] All TypeScript errors resolved (`0 errors` in typecheck)
- [ ] Test coverage ≥ 80% (check CI output)

### Security
- [ ] No new `z.any()` in API schemas
- [ ] All new API routes have appropriate auth guard
- [ ] No secrets committed to git
- [ ] `.env.example` updated if new env vars added
- [ ] CORS headers unchanged unless intentional
- [ ] New external service integrations reviewed for trust boundary impact

### Database
- [ ] If migration included: tested on staging first
- [ ] If migration included: pre-production backup created
- [ ] If migration included: rollback plan documented
- [ ] No `DROP TABLE` without explicit approval
- [ ] All new tables have RLS policies (or justified exception)
- [ ] Migration idempotent (can be re-run safely)

### API Changes
- [ ] No breaking changes to public API without versioning
- [ ] Backward-compatible with current Electron PrintBridge app version
- [ ] New endpoints documented in route inventory
- [ ] Rate limiting applied to new write endpoints

### Monitoring
- [ ] New error paths have appropriate `log.error()` calls
- [ ] New business events have `log.info()` audit entries
- [ ] Alert policy updated if new thresholds needed
- [ ] Health check unchanged or updated for new dependencies

### Feature-Specific (check applicable)

**Payment changes:**
- [ ] Tested with Stripe test cards (including decline scenarios)
- [ ] Webhook handling tested with Stripe CLI
- [ ] No changes to fee calculation without CFO sign-off

**Auth changes:**
- [ ] Session/cookie behavior unchanged
- [ ] Password reset flow still functional
- [ ] Role guards tested for each role (owner, manager, staff)

**PrintBridge changes:**
- [ ] Backward-compatible with existing print agents
- [ ] Job status transitions tested
- [ ] Webhook signing still functional

**Shopify changes:**
- [ ] OAuth flow tested in test store
- [ ] Webhook HMAC verification still enforced

---

## Deployment Steps

1. **Create backup** (if migration): Supabase Dashboard → Database → Backups → Create
2. **Apply migration** (if any): `supabase db push` to production
3. **Deploy code**: Merge PR → Vercel auto-deploys
4. **Smoke test** (see below)
5. **Monitor** for 30 minutes post-deploy

---

## Post-Deployment Smoke Test

Run within 5 minutes of deployment:

```bash
# 1. Health check
curl -s https://orderflow.co.uk/api/health | jq .
# Expected: { "status": "healthy" }

# 2. Auth protected endpoint (should return 401)
curl -s https://orderflow.co.uk/api/orders | jq .error
# Expected: "Unauthorized"

# 3. Cron protected endpoint (should return 401)
curl -s -X POST https://orderflow.co.uk/api/cron/engagement | jq .
# Expected: 401

# 4. Shopify orders GET without auth (should return 401)
curl -s https://orderflow.co.uk/api/shopify/orders | jq .
# Expected: 401

# 5. Public menu read (should work)
curl -s "https://orderflow.co.uk/api/menu-items?restaurant_id=<test_id>" | jq .
```

**Manual smoke (browser):**
- [ ] Login with test owner account
- [ ] View dashboard (orders visible)
- [ ] View menu (items visible)
- [ ] Check kitchen view
- [ ] Verify print job creation (test job)

---

## Rollback Decision Criteria

Trigger an immediate rollback if:
- Health check returns non-200 for > 2 minutes
- Error rate > 2% for > 2 minutes
- Checkout failing for any user
- Any P0 alert fires within 30 minutes of deployment

See [Rollback Runbook](./rollback-runbook.md) for rollback procedure.

---

## Release Communication

**Slack #deployments (after successful deploy):**
```
✅ Deployed to production
Version: <git SHA short>
Changes: <brief summary>
Smoke test: PASSED
Monitoring: All green
```

**If rollback needed:**
```
⚠️ Rolled back production deployment
Reason: <brief reason>
Version restored: <previous SHA>
Status: Investigating
```
