# Secrets Register & Rotation Runbook
**E2-T02 / E2-T03 — Secrets Inventory and Rotation Procedures**
Last updated: 2026-03-08 | Status: Certified

---

## Secret Inventory

| Secret | Environment Variable | Used By | Rotation Period | Who Rotates |
|--------|---------------------|---------|-----------------|-------------|
| Supabase anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web client | 90 days | Platform admin |
| Supabase service role key | `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB | 90 days | Platform admin |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | All | On project change | Platform admin |
| NextAuth secret | `NEXTAUTH_SECRET` | JWT signing | 180 days | Platform admin |
| NextAuth URL | `NEXTAUTH_URL` | NextAuth | On domain change | DevOps |
| Stripe secret key | `STRIPE_SECRET_KEY` | Payment processing | On compromise | Finance/Admin |
| Stripe webhook secret | `STRIPE_WEBHOOK_SECRET` | Webhook verification | On compromise | Finance/Admin |
| Shopify API key | `SHOPIFY_API_KEY` | Shopify OAuth | On compromise | Integrations |
| Shopify API secret | `SHOPIFY_API_SECRET` | Shopify HMAC | On compromise | Integrations |
| Internal API secret | `INTERNAL_API_SECRET` | Service-to-service | 90 days | Platform admin |
| Cron secret | `CRON_SECRET` | Cron auth | 90 days | Platform admin |
| Upstash Redis URL | `UPSTASH_REDIS_REST_URL` | Rate limiting | On compromise | DevOps |
| Upstash Redis token | `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | 90 days | DevOps |
| Slack webhook | `SLACK_ALERT_WEBHOOK` | Alerting | On compromise | DevOps |
| SendGrid API key | `SENDGRID_API_KEY` | Email delivery | 90 days | Platform admin |
| API Gateway key | `API_GATEWAY_API_KEY` | Worker auth | 90 days | Platform admin |

---

## Rotation Procedures

### Standard Rotation (90-day cycle)

1. **Generate new secret**: Use `openssl rand -base64 32` or platform secret manager
2. **Add to Vercel**: Settings → Environment Variables → add new value
3. **Deploy**: Trigger Vercel deployment to pick up new secret
4. **Verify**: Call `/api/health` and check a protected endpoint
5. **Revoke old**: Remove old secret from Vercel env vars
6. **Document**: Update this register with rotation date

### Supabase Service Role Key Rotation

1. Go to Supabase Dashboard → Settings → API
2. Generate new service role key
3. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel
4. Deploy (zero-downtime; old key still valid briefly)
5. Revoke old key in Supabase Dashboard
6. **Impact:** Brief window where old and new keys both valid — acceptable

### NextAuth Secret Rotation

⚠️ **Rotating invalidates all existing sessions**

1. Generate new secret: `openssl rand -base64 32`
2. Schedule maintenance window (optional if sessions can be invalidated)
3. Update `NEXTAUTH_SECRET` in Vercel
4. Deploy — all users will be signed out
5. Notify users in advance if possible

### Stripe Key Rotation

1. Go to Stripe Dashboard → Developers → API Keys
2. Roll the key (Stripe provides overlap period)
3. Update `STRIPE_SECRET_KEY` in Vercel
4. For webhook secret: Webhooks → Edit → reveal signing secret
5. Update `STRIPE_WEBHOOK_SECRET` in Vercel
6. Deploy

### Emergency Rotation (Compromise Suspected)

**IMMEDIATE ACTIONS (< 30 minutes):**
1. Revoke compromised key in source system
2. Generate new key
3. Update Vercel env var
4. Deploy immediately (use `vercel --prod --force`)
5. Review audit logs for unauthorised access
6. Page incident commander (see incident runbook)
7. File incident report within 4 hours

---

## Secret Generation Standards

| Type | Command | Minimum Entropy |
|------|---------|-----------------|
| General secrets | `openssl rand -base64 32` | 256 bits |
| HMAC signing keys | `openssl rand -hex 32` | 256 bits |
| Cron secrets | `openssl rand -base64 24` | 192 bits |
| API keys (user-facing) | `crypto.randomBytes(32).toString('hex')` | 256 bits |

**Never use:**
- Sequential numbers
- UUIDs (only 122 bits entropy)
- Readable phrases
- Anything from a password generator with <128 bits

---

## Secret Storage Rules

1. **Vercel Environment Variables** — production secrets only
2. **`.env.local`** — developer local secrets; never committed
3. **`.env.example`** — placeholders only; committed to git
4. **GitHub Actions Secrets** — CI secrets (separate from Vercel)
5. **Never in:**
   - Source code (even in comments)
   - Git history
   - Log output
   - Error messages
   - Client-side JavaScript bundles

> **Audit:** No secrets found in git history as of 2026-03-08. Run `git log -S "secret" --all` periodically to verify.
