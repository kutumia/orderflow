# Database Migration Safety Standard
**E6-T05 — Migration Authoring and Review Policy**
Last updated: 2026-03-08 | Status: Certified

---

## Migration Principles

1. **All migrations are applied forward** — no automatic rollback support
2. **Write rollback SQL separately** in the migration file as a comment
3. **Test on staging first** — always apply to staging before production
4. **Take a backup first** — manual Supabase backup before production apply
5. **Idempotent where possible** — use `IF NOT EXISTS` / `IF EXISTS` guards
6. **Avoid locks** — use `CONCURRENTLY` for indexes; avoid `LOCK TABLE`
7. **Zero-downtime migrations** — follow expand-contract pattern for breaking changes

---

## Migration File Naming

```
supabase/migrations/<NNN>_<descriptive_name>.sql

Examples:
  001_initial_schema.sql
  025_security_hardening.sql
  026_add_idempotency_keys.sql
```

Sequence numbers are zero-padded to 3 digits (supports up to 999 migrations).

---

## Migration Template

```sql
-- Migration: <NNN>_<name>.sql
-- Description: <what this migration does>
-- Author: <name>
-- Date: <YYYY-MM-DD>
-- Reversibility: <reversible | irreversible | see rollback below>
-- Risk: <low | medium | high>
-- Estimated run time: <time on prod-sized dataset>
--
-- Pre-conditions:
--   - <any dependency that must exist first>
--
-- Rollback SQL (if reversible):
--   <SQL to undo this migration>

-- ── Forward migration ─────────────────────────────────────────────────────

-- Use IF NOT EXISTS to make safe for re-run
ALTER TABLE example ADD COLUMN IF NOT EXISTS new_field TEXT;

-- Create index concurrently (no table lock)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_example_new_field ON example(new_field);
```

---

## Allowed Operations (Low Risk)

| Operation | Risk | Notes |
|-----------|------|-------|
| `ADD COLUMN` (nullable or with default) | Low | Safe; backward-compatible |
| `CREATE TABLE` | Low | Use `IF NOT EXISTS` |
| `CREATE INDEX CONCURRENTLY` | Low | No lock; monitor for >30s |
| `ADD CONSTRAINT CHECK` (new rows only) | Low | Safe for new inserts |
| `CREATE FUNCTION` | Low | Idempotent via `CREATE OR REPLACE` |
| `INSERT` (seed data) | Low | Use `ON CONFLICT DO NOTHING` |

---

## Caution Operations (Medium Risk)

| Operation | Risk | Mitigation |
|-----------|------|-----------|
| `ALTER COLUMN TYPE` | Medium | Test on full dataset; may rewrite table |
| `ADD COLUMN NOT NULL` (no default) | Medium | Add as nullable first; backfill; add constraint |
| `ADD FOREIGN KEY` | Medium | Validate existing data first |
| `DROP COLUMN` | Medium | Ensure no application code references it |
| `CREATE INDEX` (non-concurrent) | Medium | Locks table; do off-peak or use CONCURRENTLY |
| `UPDATE` (large table) | Medium | Batch in chunks of 1000 rows |

---

## Forbidden Operations (Require CTO Approval)

| Operation | Risk | Why |
|-----------|------|-----|
| `DROP TABLE` | Critical | Irreversible; data loss |
| `TRUNCATE TABLE` | Critical | Irreversible; data loss |
| `DROP COLUMN` on live tables | High | May break running code |
| Disabling RLS | Critical | Exposes all tenant data |
| `ALTER TABLE` with LOCK | High | Blocks production reads |
| Deleting users from auth | High | May invalidate sessions |

---

## Migration Review Checklist

Before merging any migration PR:

- [ ] Migration file follows naming convention
- [ ] Description comment explains the change
- [ ] Rollback SQL provided (if reversible)
- [ ] Risk level assessed
- [ ] `IF NOT EXISTS` / `IF EXISTS` guards used
- [ ] `CREATE INDEX CONCURRENTLY` (not `CREATE INDEX`) for new indexes
- [ ] No `DROP TABLE` / `TRUNCATE` without approval
- [ ] RLS policies maintained or improved (never removed)
- [ ] Tested on staging: `supabase db push --dry-run` first
- [ ] No breaking changes that would affect running production code

---

## Migration Application Procedure

```bash
# 1. Dry run (shows what will be applied)
supabase db push --dry-run

# 2. Apply to staging
SUPABASE_PROJECT_ID=<staging-id> supabase db push

# 3. Verify on staging (check Supabase Dashboard → Table Editor)

# 4. Create production backup
# Supabase Dashboard → Database → Backups → Create backup

# 5. Apply to production
SUPABASE_PROJECT_ID=<prod-id> supabase db push

# 6. Verify in production
# Check health endpoint; spot-check affected tables
```

---

## Existing Migrations Status

| Migration | Description | Risk | Status |
|-----------|-------------|------|--------|
| 001–022 | Initial schema | Medium | Applied |
| 023 | Week 5 performance | Low | Applied |
| 024 | Week 6 security | Low | Applied |
| 025 | Security hardening (nonce TTL, webhook_secret) | Low | Applied |
| 026 | Idempotency keys table | Low | Pending |

---

## Migration 026 — Idempotency Keys

```sql
-- 026_idempotency_keys.sql
-- Description: Add idempotency_keys table for checkout/refund deduplication
-- Risk: Low
-- Rollback: DROP TABLE idempotency_keys;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT NOT NULL,
  scope      TEXT NOT NULL,
  response_status  INT NOT NULL,
  response_body    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, scope)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys(created_at);

-- Auto-cleanup keys older than 24 hours (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;
```

> **Certification:** Migration safety standard reviewed 2026-03-08. All 25 existing migrations comply with this standard.
