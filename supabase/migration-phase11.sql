-- ══════════════════════════════════════════════════════════
-- Phase 11 Migration — Compliance, Exports & Operations
-- Run AFTER migration-phase10.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 11.1 UK Compliance — VAT
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 20.00;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vat_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- ─────────────────────────────────────
-- 11.1 GDPR — soft delete tracking
-- ─────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gdpr_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gdpr_deleted_at TIMESTAMPTZ;

-- ─────────────────────────────────────
-- 11.3 Onboarding email tracking
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS onboarding_emails_sent JSONB DEFAULT '{}';

-- ─────────────────────────────────────
-- 11.3 Admin impersonation tracking
-- ─────────────────────────────────────
-- We use the admin_audit_log table (created in Phase 9)
-- No new table needed — impersonation uses JWT

-- ─────────────────────────────────────
-- 11.4 Drag-to-reorder
-- ─────────────────────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Set initial sort_order based on created_at
UPDATE categories SET sort_order = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY restaurant_id ORDER BY created_at) AS rn FROM categories) sub
WHERE categories.id = sub.id AND categories.sort_order = 0;

UPDATE menu_items SET sort_order = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at) AS rn FROM menu_items) sub
WHERE menu_items.id = sub.id AND menu_items.sort_order = 0;

-- ══════════════════════════════════════════════════════════
-- Phase 11 Migration Complete
-- ══════════════════════════════════════════════════════════
