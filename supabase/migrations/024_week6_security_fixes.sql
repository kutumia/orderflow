-- Week 6 Security Fixes
-- Addresses P0/P1/P2 vulnerabilities identified in security audit.

-- ─────────────────────────────────────────────────────────────────────────────
-- [P0] Kitchen display auth: add per-restaurant kitchen_token
--
-- The old slug-only auth let anyone who knows the public slug (same as the
-- customer ordering URL) read all active orders and change statuses.
-- kitchen_token is a random 64-char hex string shown once in the dashboard
-- settings. The kitchen tablet URL becomes:
--   /kitchen/<slug>?token=<kitchen_token>
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS kitchen_token TEXT UNIQUE
    DEFAULT encode(gen_random_bytes(32), 'hex');

-- Backfill: any existing restaurant without a token gets one now.
UPDATE restaurants
SET kitchen_token = encode(gen_random_bytes(32), 'hex')
WHERE kitchen_token IS NULL;

ALTER TABLE restaurants
  ALTER COLUMN kitchen_token SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- [P2] Order status endpoint: add customer_token for authenticated lookups
--
-- Previously anyone with an order UUID could read customer PII (name, phone,
-- delivery address, items). Now the status endpoint requires both the order ID
-- and this random token, which is returned only to the customer at checkout.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_token TEXT
    DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill existing orders so the column is never NULL.
UPDATE orders
SET customer_token = encode(gen_random_bytes(16), 'hex')
WHERE customer_token IS NULL;

ALTER TABLE orders
  ALTER COLUMN customer_token SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- [P1] Promo code column name drift: fix increment_promo_usage
--
-- migration-patches.sql defined this function referencing column `uses`, but
-- the schema declares `use_count`. This caused a runtime "column does not
-- exist" error on every promo redemption.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_promo_usage(promo_uuid UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE promo_codes
  SET use_count = use_count + 1
  WHERE id = promo_uuid
    AND is_active = TRUE
    AND (max_uses IS NULL OR max_uses = 0 OR use_count < max_uses);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promo code usage limit reached or not found';
  END IF;
END;
$$;
