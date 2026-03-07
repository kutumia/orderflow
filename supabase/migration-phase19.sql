-- ══════════════════════════════════════════════════════════
-- Phase 19 Migration — Growth & Retention Loops
-- Run AFTER migration-phase18.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 19.1 Referral Program
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  reward_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  referrer_restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  referred_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  referred_email TEXT,
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,                -- first paid month
  referrer_rewarded BOOLEAN DEFAULT FALSE,
  referred_discount_applied BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_referral_signups_code ON referral_signups(code);
CREATE INDEX idx_referral_codes_restaurant ON referral_codes(restaurant_id);

-- ─────────────────────────────────────
-- 19.2 Automation Logs
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,             -- we_miss_you | loyalty_ready | reorder_reminder | weekly_digest
  customer_email TEXT,
  channel TEXT DEFAULT 'email',           -- email | sms | push
  promo_code TEXT,                        -- auto-generated code if applicable
  status TEXT DEFAULT 'sent',             -- sent | opened | converted | failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_logs_restaurant ON automation_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_automation_logs_customer ON automation_logs(customer_email, trigger_type);

-- ─────────────────────────────────────
-- 19.3 Customer order frequency tracking
-- ─────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS avg_order_frequency_days NUMERIC,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- ─────────────────────────────────────
-- 19.4 Dine-in & Table QR
-- ─────────────────────────────────────
-- Add dine_in as valid order type (existing order_type is TEXT, so just use it)
-- Add table_number to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_number INTEGER;

-- ══════════════════════════════════════════════════════════
-- Phase 19 Migration Complete
-- ══════════════════════════════════════════════════════════
