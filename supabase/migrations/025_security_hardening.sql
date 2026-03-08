-- Week 7 Security Hardening
-- Addresses remaining P1/P2 vulnerabilities identified in post-audit review.

-- ─────────────────────────────────────────────────────────────────────────────
-- [P1] Shopify OAuth nonce TTL — add created_at timestamp
--
-- Previously nonces had no expiry. An attacker who intercepted an old valid
-- nonce (e.g. via logs or network capture) could replay it to hijack an
-- OAuth flow. The callback route now rejects nonces older than 15 minutes
-- using a .gt("created_at", cutoff) query — this column enables that check.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE shopify_nonces
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows so the column is queryable (old rows will expire immediately)
UPDATE shopify_nonces
SET created_at = NOW() - INTERVAL '1 hour'
WHERE created_at IS NULL;

ALTER TABLE shopify_nonces
  ALTER COLUMN created_at SET NOT NULL;

-- Index for the TTL lookups in the callback route
CREATE INDEX IF NOT EXISTS idx_shopify_nonces_created_at
  ON shopify_nonces (created_at);

-- Auto-cleanup: delete stale nonces older than 1 hour to keep the table small
-- This is advisory — the route validates TTL independently
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM shopify_nonces WHERE created_at < NOW() - INTERVAL '1 hour';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- [P2] PrintBridge tenant webhook secret
--
-- webhook_secret is used to sign outgoing webhook payloads with HMAC-SHA256.
-- Recipients verify the X-PrintBridge-Signature header to confirm authenticity.
-- Existing tenants get a random secret on migration.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pb_tenants
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT
    DEFAULT encode(gen_random_bytes(32), 'hex');

-- Backfill existing tenants
UPDATE pb_tenants
SET webhook_secret = encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;

ALTER TABLE pb_tenants
  ALTER COLUMN webhook_secret SET NOT NULL;
