-- ══════════════════════════════════════════════════════════
-- Phase 9 Migration — Critical Fixes & Security Hardening
-- Run AFTER the initial schema.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- FIX: UNIQUE constraint on stripe_payment_intent_id (BUG-004)
-- Prevents duplicate order creation from webhook retries
-- ─────────────────────────────────────
ALTER TABLE orders
  ADD CONSTRAINT orders_stripe_pi_unique
  UNIQUE (stripe_payment_intent_id);

-- ─────────────────────────────────────
-- FIX: Per-restaurant order numbers (BUG-005)
-- Remove global SERIAL, use trigger for per-restaurant sequence
-- ─────────────────────────────────────

-- Step 1: Change column to plain INTEGER (keep existing data)
-- Note: In PostgreSQL, we can't easily drop SERIAL, so we drop the default
ALTER TABLE orders ALTER COLUMN order_number DROP DEFAULT;

-- Drop the auto-created sequence if it exists
DROP SEQUENCE IF EXISTS orders_order_number_seq CASCADE;

-- Step 2: Create the per-restaurant order number trigger
CREATE OR REPLACE FUNCTION generate_restaurant_order_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(order_number), 0) + 1
  INTO NEW.order_number
  FROM orders
  WHERE restaurant_id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_restaurant_order_number();

-- Add unique constraint per restaurant
ALTER TABLE orders
  ADD CONSTRAINT orders_restaurant_number_unique
  UNIQUE (restaurant_id, order_number);

-- ─────────────────────────────────────
-- FIX: Atomic promo code increment (BUG-020)
-- Prevents race condition on concurrent orders with same promo
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_promo_usage(promo_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE promo_codes
  SET use_count = use_count + 1
  WHERE id = promo_uuid
    AND (max_uses IS NULL OR use_count < max_uses)
  RETURNING use_count INTO new_count;

  RETURN new_count;  -- Returns NULL if already maxed out
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────
-- ADD: Timezone support for restaurants (BUG-008)
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/London';

-- ─────────────────────────────────────
-- ADD: Kitchen PIN for KDS authentication (BUG-010)
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS kitchen_pin TEXT;

-- ─────────────────────────────────────
-- ADD: Password reset tokens (FEAT-007)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ─────────────────────────────────────
-- ADD: Admin audit log (BUG-024)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_restaurant_id UUID REFERENCES restaurants(id),
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);

-- ─────────────────────────────────────
-- ADD: Receipt data storage on print jobs (BUG-018)
-- ─────────────────────────────────────
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS receipt_data TEXT;

-- ─────────────────────────────────────
-- ADD: Onboarding email tracking
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_emails_sent JSONB DEFAULT '{}';

-- ─────────────────────────────────────
-- ADD: Trial end date on restaurants for easy checking
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ─────────────────────────────────────
-- Performance indexes (BUG-017)
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON orders(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_status
  ON orders(restaurant_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant_last_order
  ON customers(restaurant_id, last_order_at DESC);

-- ══════════════════════════════════════════════════════════
-- Phase 9 Migration Complete
-- ══════════════════════════════════════════════════════════
