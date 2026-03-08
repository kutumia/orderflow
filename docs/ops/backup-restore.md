# Backup & Restore Runbook
**E5-T04 — Data Backup and Recovery Procedures**
Last updated: 2026-03-08 | Status: Certified

---

## Backup Strategy

### Supabase (Primary Database)

| Backup Type | Frequency | Retention | RPO |
|-------------|-----------|-----------|-----|
| WAL archive (continuous) | Continuous | 7 days | Near-zero (seconds) |
| Daily snapshot | Daily 02:00 UTC | 7 days (Pro plan) | 24 hours |
| Pre-migration manual backup | Before each migration | 30 days | Point-in-time |
| Monthly snapshot | Monthly | 12 months | 1 month |

**Where:** Supabase Dashboard → Database → Backups

### File Storage (Supabase Storage)

| Data | Backup | Retention |
|------|--------|-----------|
| Menu item images | Supabase Storage replicated | Per Supabase SLA |
| QR code images | Regeneratable; no backup needed | — |

### Configuration Data

| Data | Backup | Restore |
|------|--------|---------|
| Environment variables | Documented in secrets register | Re-enter from register |
| Vercel config (`vercel.json`) | Git repository | Re-deploy |
| Supabase migrations | Git repository (`supabase/migrations/`) | Re-apply via `supabase db push` |

---

## Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| RTO (Recovery Time Objective) | 2 hours | Time to restore service |
| RPO (Recovery Point Objective) | 1 hour | Maximum data loss |
| MTTR (Mean Time to Recover) | 30 minutes | For typical incidents |

---

## Restore Procedures

### Scenario A: Accidental Data Deletion (Rows)

**< 7 days ago:** Use Supabase Point-in-Time Recovery (PITR)

1. Supabase Dashboard → Database → Backups
2. Select restore point (just before deletion)
3. Restore to new project (don't overwrite production directly)
4. Extract the deleted data via `pg_dump` from restored project
5. Import specific rows into production

```sql
-- Example: restore deleted orders
-- (After extracting from PITR restore)
INSERT INTO orders (id, restaurant_id, ...)
SELECT id, restaurant_id, ...
FROM backup_orders
WHERE deleted_at > '2026-03-08 10:00:00';
```

### Scenario B: Migration Gone Wrong

**Immediate (< 10 minutes):** Roll forward with a fix migration

1. Write a fix migration that reverses the damage
2. Apply via `supabase db push` to production
3. Verify data integrity

**If data loss occurred:** Restore from pre-migration backup

```bash
# 1. Download pre-migration backup from Supabase Dashboard
# 2. Restore to test project to verify
# 3. Extract affected tables
pg_dump --table orders --data-only "$BACKUP_DATABASE_URL" > orders_backup.sql

# 4. Apply to production (ensure no ongoing writes first)
psql "$DATABASE_URL" < orders_backup.sql
```

### Scenario C: Full Database Restore

> **Warning:** This overwrites ALL production data. Requires CTO approval.

1. Stop all production traffic (Vercel → Pause deployments or add maintenance middleware)
2. Supabase Dashboard → Database → Backups → Select snapshot
3. Click "Restore" (Supabase will spin up new DB from snapshot)
4. Swap connection strings in Vercel (update `SUPABASE_*` env vars)
5. Run any migrations applied after the backup
6. Resume traffic
7. Verify with end-to-end test

**Estimated time:** 30–90 minutes depending on DB size.

### Scenario D: Vercel Deployment Restore

```bash
# List recent production deployments
vercel ls --prod

# Promote a previous deployment
vercel rollback <deployment-url> --token $VERCEL_TOKEN

# Or via Vercel Dashboard: Deployments → Select → Promote to Production
```

---

## Pre-Migration Backup Checklist

Before running any Supabase migration:

```bash
# 1. Create manual backup via Supabase Dashboard → Database → Backups → Create new backup
# 2. Label it: "pre-migration-NNN-YYYY-MM-DD"
# 3. Verify backup completed (status = ready)
# 4. Note restore point timestamp
# 5. Run migration on staging first
# 6. Verify staging results
# 7. Apply to production
```

---

## Backup Testing

| Test | Frequency | Owner |
|------|-----------|-------|
| PITR restore drill (to test project) | Monthly | Engineering |
| Verify backup completion | Weekly | Engineering (automated check) |
| Full restore simulation | Quarterly | Engineering + CTO |
| Migration rollback drill | Before each migration | Deploying engineer |

---

## Contact for Restore

| Situation | Contact |
|-----------|---------|
| Data deletion < 24hr | Engineering on-call |
| Major data loss | CTO + Engineering on-call |
| Supabase platform issue | Supabase support (support@supabase.io) |
| PCI data concern | CTO + Legal |

> **Certification:** Backup procedures reviewed 2026-03-08. PITR verified operational. Pre-migration backup procedure tested on migration 025.
