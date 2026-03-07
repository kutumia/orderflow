-- ══════════════════════════════════════════════════════════
-- Phase 13 Migration — Revenue & Retention Engine
-- Run AFTER migration-phase12.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 13.1 Loyalty Programs
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'stamps', -- stamps | points
  stamps_required INTEGER DEFAULT 8,
  points_per_pound INTEGER DEFAULT 1,
  points_to_redeem INTEGER DEFAULT 100,
  reward_type TEXT DEFAULT 'discount', -- free_item | discount | free_delivery
  reward_value INTEGER DEFAULT 500, -- pence for discount, 0 for free_delivery
  reward_item_name TEXT, -- for free_item type
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_loyalty_programs_restaurant ON loyalty_programs(restaurant_id);

CREATE TABLE IF NOT EXISTS loyalty_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  stamps_earned INTEGER DEFAULT 0,
  stamps_redeemed INTEGER DEFAULT 0,
  points_balance INTEGER DEFAULT 0,
  total_rewards_redeemed INTEGER DEFAULT 0,
  last_earn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_loyalty_cards_unique ON loyalty_cards(restaurant_id, customer_email);
CREATE INDEX idx_loyalty_cards_email ON loyalty_cards(customer_email);

-- ─────────────────────────────────────
-- 13.3 Marketing Campaigns
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email', -- email | sms
  subject TEXT,
  body TEXT NOT NULL,
  template TEXT, -- new_menu | special_offer | we_miss_you | custom
  audience_filter JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- draft | sending | sent | failed
  sent_count INTEGER DEFAULT 0,
  stats JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_restaurant ON marketing_campaigns(restaurant_id, created_at DESC);

-- ─────────────────────────────────────
-- 13.5 Automated triggers
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS auto_triggers JSONB DEFAULT '{"we_miss_you": false, "loyalty_ready": false}';

-- ─────────────────────────────────────
-- Add loyalty_redeemed to orders
-- ─────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_discount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_reward_type TEXT;

-- ══════════════════════════════════════════════════════════
-- Phase 13 Migration Complete
-- ══════════════════════════════════════════════════════════
