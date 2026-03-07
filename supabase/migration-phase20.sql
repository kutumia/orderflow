-- ══════════════════════════════════════════════════════════
-- Phase 20 Migration — Enterprise Foundations
-- Run AFTER migration-phase19.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 20.1 Multi-Location — user_restaurants join table
-- Allows one user to own multiple restaurants.
-- Existing restaurant_id on users becomes the "active" location.
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',         -- owner | manager | staff
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

CREATE INDEX idx_user_restaurants_user ON user_restaurants(user_id);
CREATE INDEX idx_user_restaurants_restaurant ON user_restaurants(restaurant_id);

-- Backfill: copy existing user→restaurant links into join table
INSERT INTO user_restaurants (user_id, restaurant_id, role, is_primary)
SELECT id, restaurant_id, role, TRUE
FROM users
WHERE restaurant_id IS NOT NULL
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- ─────────────────────────────────────
-- 20.2 Menu Templates
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  template_data JSONB NOT NULL,       -- { categories: [{ name, items: [{ name, price, description }] }] }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────
-- 20.3 Menu sync link between locations
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS synced_with_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- ─────────────────────────────────────
-- 20.3 Performance alerts log
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,           -- revenue_drop | no_orders
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_performance_alerts_restaurant ON performance_alerts(restaurant_id, created_at DESC);

-- ══════════════════════════════════════════════════════════
-- Phase 20 Migration Complete
-- ══════════════════════════════════════════════════════════
