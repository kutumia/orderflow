# Secret Rotation Runbook — E2-T03
**Step-by-Step Procedures for All Secrets**
Last updated: 2026-03-08 | Status: Certified

---

## Principles

1. **Zero-downtime rotation**: New secret deployed before old one is revoked
2. **Immediate rotation on suspected compromise** — do not wait for scheduled rotation
3. **Audit everything**: Log secret rotation events in #security-ops Slack channel
4. **Verify after rotation**: Run auth smoke tests (`docs/security/auth-smoke-tests.md`) after every rotation

---

## Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Due |
|--------|-------------------|--------------|----------|
| `STRIPE_SECRET_KEY` | 6 months | 2026-03-08 | 2026-09-08 |
| `STRIPE_WEBHOOK_SECRET` | 6 months | 2026-03-08 | 2026-09-08 |
| `SUPABASE_SERVICE_ROLE_KEY` | 6 months | 2026-03-08 | 2026-09-08 |
| `NEXTAUTH_SECRET` | 6 months | 2026-03-08 | 2026-09-08 |
| `CRON_SECRET` | 3 months | 2026-03-08 | 2026-06-08 |
| `INTERNAL_API_SECRET` | 3 months | 2026-03-08 | 2026-06-08 |
| `API_GATEWAY_API_KEY` | 3 months | 2026-03-08 | 2026-06-08 |
| Shopify OAuth tokens | Per-tenant, on disconnect | — | On request |
| PrintBridge API keys | On staff offboarding | — | On request |
| `UPSTASH_REDIS_REST_TOKEN` | 12 months | 2026-03-08 | 2027-03-08 |

---

## Rotation Procedures

### 1. `STRIPE_SECRET_KEY`

**Time required:** ~5 minutes | **Downtime:** Zero

```bash
# Step 1: In Stripe Dashboard → Developers → API Keys
# Create a new Restricted Key (or Standard Key)
# Copy the new key (shown ONCE)

# Step 2: Update Vercel environment variable (production)
vercel env add STRIPE_SECRET_KEY production
# Paste new key when prompted

# Step 3: Redeploy to apply new key
vercel --prod

# Step 4: Verify checkout works
curl -X POST https://api.orderflow.app/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"<test-id>","items":[...]}'
# Expected: 200 with clientSecret

# Step 5: Revoke old key in Stripe Dashboard
# Step 6: Log in #security-ops: "STRIPE_SECRET_KEY rotated 2026-03-08 by [name]"
```

---

### 2. `STRIPE_WEBHOOK_SECRET`

**Time required:** ~10 minutes | **Downtime:** Brief (webhooks during rotation may return 400)

```bash
# Step 1: Stripe Dashboard → Developers → Webhooks → [endpoint]
# Click "Roll endpoint secret"
# Copy new webhook secret

# Step 2: Update Vercel env var
vercel env add STRIPE_WEBHOOK_SECRET production

# Step 3: Redeploy
vercel --prod

# Step 4: Send test webhook from Stripe Dashboard → "Send test event"
# Verify 200 response in Stripe webhook log

# Step 5: Log in #security-ops
```

---

### 3. `SUPABASE_SERVICE_ROLE_KEY`

**Time required:** ~15 minutes | **Downtime:** Zero (if done correctly)

> ⚠️ This key bypasses RLS. Rotation is highest priority on compromise.

```bash
# Step 1: Supabase Dashboard → Project Settings → API
# Generate new service role key (JWT re-signing)
# Note: This invalidates the old key IMMEDIATELY in Supabase

# Step 2: Update ALL environments that use this key SIMULTANEOUSLY
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
# Also update in any other services (CI/CD, scripts)

# Step 3: Redeploy immediately
vercel --prod

# Step 4: Verify health check passes
curl https://api.orderflow.app/api/health
# Expected: 200 with database.status: "ok"

# Step 5: Run auth smoke tests
bash scripts/auth-smoke-test.sh

# Step 6: Log in #security-ops: include reason if emergency rotation
```

---

### 4. `NEXTAUTH_SECRET`

**Time required:** ~5 minutes | **Downtime:** All existing sessions invalidated (users must re-login)

> ⚠️ Rotating this secret logs out all users immediately. Schedule during low-traffic period.

```bash
# Step 1: Generate new secret
openssl rand -base64 32

# Step 2: Update Vercel
vercel env add NEXTAUTH_SECRET production

# Step 3: Redeploy
vercel --prod

# Step 4: Notify restaurant owners if rotating during business hours:
# "You will need to log in again due to a security update."

# Step 5: Verify login works
# Step 6: Log in #security-ops
```

---

### 5. `CRON_SECRET`

**Time required:** ~5 minutes | **Downtime:** Zero

```bash
# Step 1: Generate new secret
openssl rand -hex 32

# Step 2: Update Vercel and Vercel Cron configuration
vercel env add CRON_SECRET production

# Step 3: Update the cron job Authorization header in vercel.json or Vercel dashboard
# The cron caller must use the new secret

# Step 4: Redeploy
vercel --prod

# Step 5: Verify cron endpoint rejects old secret (returns 401)
curl -X POST https://api.orderflow.app/api/cron/engagement \
  -H "Authorization: Bearer old-secret-here"
# Expected: 401

# Step 6: Log in #security-ops
```

---

### 6. `INTERNAL_API_SECRET`

**Time required:** ~10 minutes | **Downtime:** Zero (if API Gateway updated simultaneously)

```bash
# Step 1: Generate new secret
openssl rand -hex 32

# Step 2: Update BOTH services simultaneously
# Next.js app:
vercel env add INTERNAL_API_SECRET production
# API Gateway (Cloudflare Worker):
wrangler secret put INTERNAL_API_SECRET
# (enter new secret at prompt)

# Step 3: Deploy both
vercel --prod
wrangler deploy

# Step 4: Verify API Gateway → Next.js internal calls work
# Step 5: Log in #security-ops
```

---

### 7. PrintBridge API Keys (Per-Tenant)

**When to rotate:** Staff offboarding, suspected key compromise, quarterly for high-security tenants

```bash
# Step 1: Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Step 2: Hash it
NEW_HASH=$(echo -n "$NEW_KEY" | sha256sum | cut -d' ' -f1)

# Step 3: Insert new key (keep old key active during transition)
supabase db run "
  INSERT INTO pb_api_keys (tenant_id, key_hash, key_prefix, created_at)
  VALUES ('<tenant_id>', '$NEW_HASH', '${NEW_KEY:0:8}', NOW());
"

# Step 4: Provide new key to agent operator (ONCE — shown here only)
echo "New PrintBridge API key: $NEW_KEY"

# Step 5: Operator updates agent config with new key
# Step 6: Verify agent connects with new key (check heartbeat in dashboard)

# Step 7: Revoke old key
supabase db run "DELETE FROM pb_api_keys WHERE key_prefix = '<old_prefix>';"

# Step 8: Log in #security-ops
```

---

## Emergency Rotation Checklist

If a secret is suspected compromised:

- [ ] Rotate the secret immediately (do not wait for scheduled time)
- [ ] Update all environments (production, staging, preview)
- [ ] Redeploy immediately
- [ ] Review audit logs for unauthorised usage of the compromised secret
- [ ] If `SUPABASE_SERVICE_ROLE_KEY`: audit ALL database access since last rotation
- [ ] If GDPR-relevant data may have been accessed: notify DPO within 1 hour
- [ ] Document in incident ticket: what was compromised, when, how discovered, steps taken
- [ ] Run full auth smoke tests after rotation
- [ ] Log in #security-ops with incident reference

---

> **Certification:** Rotation runbook completed 2026-03-08. Evidence for E2-T03.
