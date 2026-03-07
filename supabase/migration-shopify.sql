-- ══════════════════════════════════════════════════════════
-- Shopify Integration Tables
-- Run alongside Phase 17 migration
-- ══════════════════════════════════════════════════════════

-- Shopify store credentials and linking
CREATE TABLE IF NOT EXISTS shopify_shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop TEXT UNIQUE NOT NULL,                    -- e.g. marios-pizza.myshopify.com
  access_token TEXT,                            -- Shopify permanent access token
  scope TEXT,                                   -- granted OAuth scopes
  restaurant_slug TEXT,                         -- linked OrderFlow restaurant slug
  is_active BOOLEAN DEFAULT TRUE,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  uninstalled_at TIMESTAMPTZ
);

CREATE INDEX idx_shopify_shops_shop ON shopify_shops(shop);

-- OAuth nonces for CSRF protection (short-lived)
CREATE TABLE IF NOT EXISTS shopify_nonces (
  shop TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Shopify sync column to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shopify_draft_order_id TEXT;

-- ══════════════════════════════════════════════════════════
-- Shopify Tables Complete
-- ══════════════════════════════════════════════════════════
