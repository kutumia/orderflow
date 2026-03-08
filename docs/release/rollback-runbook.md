# Rollback Runbook
**E6-T04 — Production Rollback Procedure**
Last updated: 2026-03-08 | Status: Certified

---

## When to Rollback

Trigger an immediate rollback (no committee needed) if:
- Health check returns 5xx for > 2 consecutive minutes post-deploy
- Error rate > 5% sustained for > 2 minutes
- Checkout is broken (P0)
- Any data corruption detected

---

## Code Rollback (< 5 minutes)

### Via Vercel Dashboard (Preferred)

1. Go to [vercel.com/orderflow](https://vercel.com) → Project → Deployments
2. Find the previous successful production deployment
3. Click `...` → **Promote to Production**
4. Confirm promotion
5. Verify: `curl -s https://orderflow.co.uk/api/health | jq .status`

### Via Vercel CLI

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Authenticate
vercel login

# List recent deployments
vercel ls --prod

# Roll back to specific deployment
vercel rollback <deployment-url> --token $VERCEL_TOKEN

# Example:
vercel rollback https://orderflow-abc123.vercel.app --token $VERCEL_TOKEN
```

### Estimated rollback time: 2–3 minutes

---

## Database Migration Rollback

**Warning:** Database rollbacks are more complex than code rollbacks.
Most migrations should be written as forward-only (expand-contract pattern).

### Case A: Migration added a new column (safe to rollback)

```sql
-- Rollback: remove the added column
ALTER TABLE <table> DROP COLUMN IF EXISTS <column>;
```

### Case B: Migration modified existing data

1. Restore from pre-migration backup (see [Backup & Restore](../ops/backup-restore.md))
2. This is a major operation — requires CTO approval and maintenance window

### Case C: Migration added an index (safe to rollback)

```sql
-- Rollback: drop the index
DROP INDEX IF EXISTS <index_name>;
```

### Case D: Migration added a table (safe to rollback)

```sql
-- Only safe if no data written yet
DROP TABLE IF EXISTS <table_name>;
```

---

## Rollback Verification Steps

```bash
# 1. Confirm deployment version changed
curl -s https://orderflow.co.uk/api/health | jq '.version'
# Should show previous commit SHA

# 2. Confirm health
curl -s https://orderflow.co.uk/api/health | jq '.status'
# Expected: "healthy"

# 3. Confirm error rate normalising
# Check Datadog/Vercel dashboard for 5xx rate dropping

# 4. Confirm checkout works
# Manual: try a test checkout in staging with rolled-back version
```

---

## Rollback Communication

**Immediately in #incidents:**
```
🔄 ROLLBACK INITIATED
Reason: [Error rate spike / Health check failing / etc.]
Previous deployment: <SHA>
Rolling back to: <SHA>
ETA: ~3 minutes
Commander: @name
```

**After successful rollback:**
```
✅ ROLLBACK COMPLETE
Status: Production on previous stable version
Health check: healthy
Error rate: [normalised / still investigating]
Next: [Root cause investigation / Hot fix in progress]
```

---

## Prevent Rollback Scenarios (Proactive)

| Risk | Mitigation |
|------|-----------|
| Breaking API change | Version the endpoint; keep old version alive |
| Irreversible migration | Use expand-contract pattern; write rollback SQL |
| Config change | Test on staging with identical env vars |
| Third-party integration | Test with sandbox/test mode first |
| Feature too risky | Use feature flag; deploy code dark |

---

## Migration Safety (Expand-Contract Pattern)

For breaking schema changes, use a 3-deployment approach:

**Deploy 1 — Expand:** Add new column/table (backward-compatible)
```sql
ALTER TABLE orders ADD COLUMN new_field TEXT;
```

**Deploy 2 — Migrate:** Backfill data; update application to write to both
```sql
UPDATE orders SET new_field = derive_value(old_field);
```

**Deploy 3 — Contract:** Remove old column once all code uses new
```sql
ALTER TABLE orders DROP COLUMN old_field;
```

This means each step is independently rollback-safe.

> **Certification:** Rollback runbook tested 2026-03-08. Vercel CLI rollback verified sub-3-minute SLA.
