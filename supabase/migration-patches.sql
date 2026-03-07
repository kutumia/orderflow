-- ══════════════════════════════════════════════════════════
-- Patch Migration — Security & Operational Fixes
-- Run AFTER all phase migrations
-- ══════════════════════════════════════════════════════════

-- Fix #19: Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                      -- create | update | delete | login | switch_location
  resource_type TEXT NOT NULL,               -- order | menu_item | settings | location | promo_code
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_restaurant ON audit_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- Fix #2: Partner dashboard access - add password hash for secure access
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS dashboard_token TEXT UNIQUE;

-- Fix #6: Better promo code atomic increment (already exists but adding safety)
-- Make the function handle concurrent calls safely with explicit row lock
CREATE OR REPLACE FUNCTION increment_promo_usage(promo_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE promo_codes
  SET uses = uses + 1
  WHERE id = promo_uuid AND (max_uses = 0 OR uses < max_uses);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promo code usage limit reached or not found';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fix #11: SMS spending tracking view
CREATE OR REPLACE VIEW sms_usage_monthly AS
SELECT
  restaurant_id,
  date_trunc('month', created_at) AS month,
  COUNT(*) AS sms_count
FROM automation_logs
WHERE channel = 'sms'
GROUP BY restaurant_id, date_trunc('month', created_at);

-- ══════════════════════════════════════════════════════════
-- Patch Migration Complete
-- ══════════════════════════════════════════════════════════
