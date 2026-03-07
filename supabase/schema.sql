-- ══════════════════════════════════════════════════════════
-- OrderFlow — Complete Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- ══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────
-- 1. RESTAURANTS (core tenant table)
-- ──────────────────────────────────────
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID,
  logo_url TEXT,
  banner_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'cancelled')),
  stripe_account_id TEXT,
  stripe_customer_id TEXT,
  vat_registered BOOLEAN DEFAULT false,
  vat_number TEXT,
  holiday_mode BOOLEAN DEFAULT false,
  holiday_message TEXT,
  printer_api_key TEXT UNIQUE,
  delivery_enabled BOOLEAN DEFAULT true,
  collection_enabled BOOLEAN DEFAULT true,
  delivery_fee INTEGER DEFAULT 250,          -- in pence
  min_order_delivery INTEGER DEFAULT 1000,   -- in pence
  min_order_collection INTEGER DEFAULT 0,
  estimated_delivery_mins INTEGER DEFAULT 45,
  estimated_collection_mins INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_owner ON restaurants(owner_id);

-- ──────────────────────────────────────
-- 2. USERS
-- ──────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'staff', 'admin')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_restaurant ON users(restaurant_id);

-- Add FK from restaurants to users (after users table exists)
ALTER TABLE restaurants ADD CONSTRAINT fk_restaurants_owner FOREIGN KEY (owner_id) REFERENCES users(id);

-- ──────────────────────────────────────
-- 3. CATEGORIES
-- ──────────────────────────────────────
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

-- ──────────────────────────────────────
-- 4. MENU ITEMS
-- ──────────────────────────────────────
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,                    -- in pence
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  allergens JSONB DEFAULT '[]'::jsonb,       -- Natasha's Law compliance
  calories INTEGER,
  vat_rate NUMERIC(5,2) DEFAULT 20.00,       -- UK standard rate
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);

-- ──────────────────────────────────────
-- 5. ITEM MODIFIERS
-- ──────────────────────────────────────
CREATE TABLE item_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                        -- e.g. "Size", "Extras"
  options JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name: "Small", price: 0}, {name: "Large", price: 200}]
  required BOOLEAN DEFAULT false,
  max_choices INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_modifiers_item ON item_modifiers(item_id);

-- ──────────────────────────────────────
-- 6. ORDERS
-- ──────────────────────────────────────
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL,                      -- full order items snapshot
  subtotal INTEGER NOT NULL,                 -- in pence
  delivery_fee INTEGER DEFAULT 0,
  discount INTEGER DEFAULT 0,
  vat_amount INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'preparing', 'ready',
    'out_for_delivery', 'delivered', 'collected',
    'cancelled', 'refunded'
  )),
  order_type TEXT NOT NULL CHECK (order_type IN ('delivery', 'collection')),
  delivery_address TEXT,
  notes TEXT,
  stripe_payment_intent_id TEXT,
  allergen_confirmed BOOLEAN DEFAULT false,
  promo_code_used TEXT,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);

-- ──────────────────────────────────────
-- 7. ORDER STATUS HISTORY
-- ──────────────────────────────────────
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id);

-- ──────────────────────────────────────
-- 8. PROMO CODES
-- ──────────────────────────────────────
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_delivery')),
  value INTEGER NOT NULL,                    -- percentage (10=10%) or pence (500=£5)
  min_order INTEGER DEFAULT 0,               -- in pence
  expiry TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promo_codes_restaurant ON promo_codes(restaurant_id);
CREATE UNIQUE INDEX idx_promo_codes_unique ON promo_codes(restaurant_id, code);

-- ──────────────────────────────────────
-- 9. CUSTOMERS
-- ──────────────────────────────────────
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,             -- in pence
  last_order_at TIMESTAMPTZ,
  loyalty_points INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  gdpr_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_restaurant ON customers(restaurant_id);
CREATE UNIQUE INDEX idx_customers_unique ON customers(restaurant_id, email);

-- ──────────────────────────────────────
-- 10. OPENING HOURS
-- ──────────────────────────────────────
CREATE TABLE opening_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  open_time TEXT NOT NULL,                   -- "11:00"
  close_time TEXT NOT NULL,                  -- "22:00"
  is_closed BOOLEAN DEFAULT false
);

CREATE INDEX idx_opening_hours_restaurant ON opening_hours(restaurant_id);

-- ──────────────────────────────────────
-- 11. PRINT JOBS
-- ──────────────────────────────────────
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'printing', 'printed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  printed_at TIMESTAMPTZ
);

CREATE INDEX idx_print_jobs_restaurant ON print_jobs(restaurant_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);

-- ──────────────────────────────────────
-- 12. SUBSCRIPTIONS
-- ──────────────────────────────────────
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'growth' CHECK (plan IN ('starter', 'growth', 'pro')),
  status TEXT DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_restaurant ON subscriptions(restaurant_id);

-- ──────────────────────────────────────
-- 13. MARKETING CAMPAIGNS
-- ──────────────────────────────────────
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  audience TEXT DEFAULT 'all',               -- 'all', 'recent', or tag name
  subject TEXT,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{}'::jsonb,           -- {sent: 0, opened: 0, clicked: 0}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_restaurant ON marketing_campaigns(restaurant_id);


-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════
-- Note: RLS protects data when using the anon/authenticated key.
-- The service_role key (used in API routes) bypasses RLS.

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Public read access for customer-facing pages (restaurants, categories, menu items, opening hours)
CREATE POLICY "Public can view active restaurants" ON restaurants
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view available menu items" ON menu_items
  FOR SELECT USING (is_available = true);

CREATE POLICY "Public can view item modifiers" ON item_modifiers
  FOR SELECT USING (true);

CREATE POLICY "Public can view opening hours" ON opening_hours
  FOR SELECT USING (true);

CREATE POLICY "Public can view active promo codes" ON promo_codes
  FOR SELECT USING (is_active = true);

-- Allow public to insert orders (customers placing orders)
CREATE POLICY "Public can create orders" ON orders
  FOR INSERT WITH CHECK (true);

-- RESTRICT: Public should NEVER be able to query the orders table directly. 
-- All order lookups must happen via secure Next.js API routes using the service_role key.
-- Removed: CREATE POLICY "Public can view orders" ON orders FOR SELECT USING (true);

-- Allow public to insert customers (created on order placement)
CREATE POLICY "Public can create customers" ON customers
  FOR INSERT WITH CHECK (true);


-- ══════════════════════════════════════════════════════════
-- HELPER FUNCTION: Auto-update updated_at
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restaurants_updated
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_menu_items_updated
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ══════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- ══════════════════════════════════════════════════════════
