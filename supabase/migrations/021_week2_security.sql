-- Week 2 Security Hardening Migrations
-- Run this migration to support Week 2 security fixes.

-- ─────────────────────────────────────────────────────────────
-- S-4: Admin impersonation sessions table
-- Stores server-side impersonation state instead of client-side sessionStorage.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token                 TEXT NOT NULL UNIQUE,
  admin_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  ip_address            TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imp_sessions_token   ON admin_impersonation_sessions(token);
CREATE INDEX IF NOT EXISTS idx_imp_sessions_admin   ON admin_impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_imp_sessions_expires ON admin_impersonation_sessions(expires_at);

-- Auto-clean expired sessions older than 7 days (run periodically via cron or pg_cron)
-- DELETE FROM admin_impersonation_sessions WHERE expires_at < NOW() - INTERVAL '7 days';

-- ─────────────────────────────────────────────────────────────
-- A-1: Atomic restaurant + owner creation stored procedure
-- Wraps the 5 sequential inserts into a single DB transaction.
-- Called by /api/register instead of individual queries.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_restaurant_with_owner(
  p_restaurant_name   TEXT,
  p_slug              TEXT,
  p_owner_name        TEXT,
  p_owner_email       TEXT,
  p_password_hash     TEXT,
  p_trial_ends_at     TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_restaurant_id UUID;
  v_user_id       UUID;
BEGIN
  -- 1. Create restaurant
  INSERT INTO restaurants (
    name, slug, is_active, subscription_status, trial_ends_at,
    delivery_enabled, collection_enabled,
    delivery_fee, min_order_delivery, min_order_collection,
    estimated_delivery_mins, estimated_collection_mins,
    holiday_mode, vat_registered
  ) VALUES (
    p_restaurant_name, p_slug, true, 'trialing', p_trial_ends_at,
    true, true,
    250, 1000, 0,
    45, 20,
    false, false
  )
  RETURNING id INTO v_restaurant_id;

  -- 2. Create owner user
  INSERT INTO users (
    email, name, password_hash, restaurant_id, role
  ) VALUES (
    lower(trim(p_owner_email)), trim(p_owner_name), p_password_hash, v_restaurant_id, 'owner'
  )
  RETURNING id INTO v_user_id;

  -- 3. Link owner back to restaurant
  UPDATE restaurants SET owner_id = v_user_id WHERE id = v_restaurant_id;

  -- 4. Create subscription record
  INSERT INTO subscriptions (restaurant_id, plan, status, trial_ends_at)
  VALUES (v_restaurant_id, 'growth', 'trialing', p_trial_ends_at);

  -- 5. Create default opening hours (Mon–Sun, 11am–10pm)
  INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
  SELECT v_restaurant_id, generate_series(0, 6), '11:00', '22:00', false;

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'user_id',       v_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Registration failed: %', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Performance indexes added in Week 2 (A-5 support)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id   ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id  ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant  ON customers(restaurant_id, email);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id, is_available);
