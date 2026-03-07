-- ══════════════════════════════════════════════════════════
-- Phase 15 Migration — Launch-Ready Product Polish
-- Run AFTER migration-phase14.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 15.1 Pricing Tiers
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter',         -- starter | growth | pro
  ADD COLUMN IF NOT EXISTS setup_fee_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS setup_fee_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annual_billing BOOLEAN DEFAULT FALSE;

-- Set existing restaurants to 'pro' (they had everything)
UPDATE restaurants SET plan = 'pro' WHERE plan IS NULL OR plan = 'starter';

-- ─────────────────────────────────────
-- 15.4 Email / SMS Opt-Out
-- ─────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_opt_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;

-- ─────────────────────────────────────
-- 15.3 Push Subscriptions
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subs_order ON push_subscriptions(order_id);

-- ─────────────────────────────────────
-- 15.6 Analytics — add plan to users JWT
-- ─────────────────────────────────────
-- (Handled in auth.ts — no schema change needed)

-- ══════════════════════════════════════════════════════════
-- Phase 15 Migration Complete
-- ══════════════════════════════════════════════════════════
