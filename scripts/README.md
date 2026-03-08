# Operator Scripts — E5-T03

Operational tooling for incident response and routine maintenance.

## Prerequisites

```bash
# Set required environment variables
export SUPABASE_URL=<your-supabase-url>
export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
export INTERNAL_API_SECRET=<your-internal-api-secret>
export API_BASE_URL=https://your-api.orderflow.app  # or http://localhost:3000
```

## Scripts

### `replay-webhook.ts`
Replays a stored webhook event to the webhook handler. Used during incident recovery when an event was not processed correctly.

```bash
# Dry run (preview only)
npx ts-node scripts/replay-webhook.ts --event-id <id> --dry-run

# Live replay
npx ts-node scripts/replay-webhook.ts --event-id <id>
```

**When to use:** Stripe/Shopify webhook was received but not processed due to a bug or DB outage. Find the event ID in `webhook_events` table.

---

### `retry-print-job.ts`
Requeues print jobs that are stuck in `failed` or `printing` state. Used during PrintBridge incidents.

```bash
# Retry a specific job
npx ts-node scripts/retry-print-job.ts --job-id <id> --dry-run
npx ts-node scripts/retry-print-job.ts --job-id <id>

# Retry all failed jobs for a tenant
npx ts-node scripts/retry-print-job.ts --tenant-id <id> --status failed --dry-run
npx ts-node scripts/retry-print-job.ts --tenant-id <id> --status failed

# Retry stuck 'printing' jobs (agent crashed)
npx ts-node scripts/retry-print-job.ts --tenant-id <id> --status printing
```

**When to use:** See `docs/ops/runbooks/printbridge-incident.md` — scenarios DG-08 and DG-09.

---

### `inspect-order.ts`
Full order inspection including payment state, print jobs, and audit trail.

```bash
npx ts-node scripts/inspect-order.ts --order-id <uuid>
npx ts-node scripts/inspect-order.ts --order-number <num> --restaurant-id <id>
```

**Output:** Order details, print job statuses, full audit event trail. Customer PII is masked.

---

### `inspect-tenant.ts`
Full tenant configuration including integrations, PrintBridge devices, and order stats.

```bash
npx ts-node scripts/inspect-tenant.ts --restaurant-id <id>
npx ts-node scripts/inspect-tenant.ts --slug <restaurant-slug>
```

**Output:** Restaurant config, Shopify integration status, PrintBridge devices (online/offline), 24h order stats.

---

### `disable-integration.ts`
Emergency disablement of a third-party integration (Shopify or PrintBridge) for a tenant.

```bash
# Dry run
npx ts-node scripts/disable-integration.ts --restaurant-id <id> --integration shopify --dry-run

# Disable Shopify (revokes OAuth token reference, requires manual Shopify portal revocation)
npx ts-node scripts/disable-integration.ts --restaurant-id <id> --integration shopify

# Disable PrintBridge (revokes all API keys immediately)
npx ts-node scripts/disable-integration.ts --restaurant-id <id> --integration printbridge
```

**When to use:** Security incident; tenant data compromise; urgent decommission request. See `docs/ops/runbooks/security-incident.md`.

---

## Safety

- All scripts support `--dry-run` to preview changes before applying
- Scripts use the Supabase service-role key — run only from secure operator environments
- Never commit secrets or .env files
- Log all script executions (who ran what, when, output) in your incident ticket
