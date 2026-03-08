-- Week 3 Code Quality Migrations

-- ─────────────────────────────────────────────────────────────
-- C-4: Atomic customer upsert (fixes race condition in Stripe webhook)
--
-- The old code did SELECT → INSERT/UPDATE which could result in:
--   1. Duplicate key errors when two webhook events fire concurrently
--   2. Lost increments when two updates read the same stale total_orders value
--
-- This stored procedure uses INSERT ... ON CONFLICT DO UPDATE which is a single
-- atomic statement — no race condition possible.
--
-- Requires: UNIQUE INDEX idx_customers_unique ON customers(restaurant_id, email)
-- (created in schema.sql — confirmed to exist)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_customer_order(
  p_restaurant_id  UUID,
  p_email          TEXT,
  p_name           TEXT,
  p_phone          TEXT,
  p_order_total    INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO customers (
    restaurant_id,
    email,
    name,
    phone,
    total_orders,
    total_spent,
    last_order_at,
    gdpr_consent_at
  ) VALUES (
    p_restaurant_id,
    lower(trim(p_email)),
    p_name,
    p_phone,
    1,
    p_order_total,
    NOW(),
    NOW()
  )
  ON CONFLICT (restaurant_id, email) DO UPDATE SET
    name         = EXCLUDED.name,
    phone        = EXCLUDED.phone,
    total_orders = customers.total_orders + 1,
    total_spent  = customers.total_spent + EXCLUDED.total_spent,
    last_order_at = EXCLUDED.last_order_at;
    -- gdpr_consent_at intentionally not updated on conflict: we keep the original consent timestamp
END;
$$;
