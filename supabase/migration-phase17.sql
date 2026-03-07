-- ══════════════════════════════════════════════════════════
-- Phase 17 Migration — Distribution Channels
-- Run AFTER migration-phase15.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 17.4 Agency Partner Program
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  website TEXT,
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending | approved | suspended
  commission_rate NUMERIC DEFAULT 0.20,   -- 20%
  commission_months INTEGER DEFAULT 6,    -- first 6 months
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT,
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,              -- first paid month
  total_commission INTEGER DEFAULT 0,    -- pence earned so far
  months_tracked INTEGER DEFAULT 0
);

CREATE INDEX idx_partner_referrals_partner ON partner_referrals(partner_id);
CREATE INDEX idx_partners_code ON partners(code);

-- ══════════════════════════════════════════════════════════
-- Phase 17 Migration Complete
-- ══════════════════════════════════════════════════════════
