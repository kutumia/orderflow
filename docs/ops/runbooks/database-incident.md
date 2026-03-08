# Runbook: Database Incident
**E5-T02 — Operations Runbook**
Severity: P0 (unreachable) / P1 (degraded)

---

## Trigger Conditions

- `/api/health` returns `checks.database.status !== "ok"`
- Database latency > 5s for > 2 minutes
- Supabase reports incident on status page

---

## Immediate Actions (0–15 minutes)

### 1. Confirm

```bash
curl -s https://orderflow.co.uk/api/health | jq '.checks.database'
# Expected: { "status": "ok", "latency_ms": <200 }
```

### 2. Check Supabase Status

1. Visit https://status.supabase.com
2. Check Supabase Dashboard → Database → Metrics

### 3. Test direct connection (from allowed IP)

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

---

## Resolution Paths

### Path A: Supabase regional outage

- Monitor Supabase status page
- Enable read-only mode (disable checkout, return maintenance message)
- Communicate to affected restaurants
- Wait for Supabase recovery

### Path B: Connection pool exhausted

1. Supabase Dashboard → Database → Connections
2. Enable PgBouncer (connection pooler) if not already enabled
3. Restart Vercel functions (new deployment to reset connections)

```bash
vercel --prod --force
```

### Path C: Slow queries

1. Supabase Dashboard → Logs → Slow Queries
2. Identify the problematic query
3. Add index if missing (via new migration)
4. Kill long-running queries via Supabase Dashboard

### Path D: Migration failure

```bash
# Check migration status
# Supabase Dashboard → Database → Migrations

# Roll back last migration if needed (see rollback runbook)
# Revert: supabase db push --dry-run to verify
```

---

## Backup & Restore

See [Backup & Restore Runbook](./backup-restore.md)

Supabase provides:
- **Continuous WAL archiving** (point-in-time recovery)
- **Daily backups** (retained 7 days on Pro plan)
- **Manual backups** before major migrations

---

## Communication Template

**Slack #incidents:**
```
:database: P0 INCIDENT — Database Unreachable
Time detected: HH:MM UTC
Health check: { "database": { "status": "error" } }
Supabase status: [OK / Investigating / Incident]
Status: Investigating
Commander: @name
```

---

## Resolution Checklist

- [ ] `checks.database.status === "ok"` for 5+ minutes
- [ ] Latency back below 500ms
- [ ] Checkout flow tested end-to-end
- [ ] Orders created during downtime are accounted for
- [ ] Status page updated
- [ ] Root cause documented
