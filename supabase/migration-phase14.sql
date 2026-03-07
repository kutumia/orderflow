-- ══════════════════════════════════════════════════════════
-- Phase 14 Migration — Scale & Performance
-- Run AFTER migration-phase13.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 14.1 Performance Indexes
-- ─────────────────────────────────────

-- Partial index: active orders only (most common query)
CREATE INDEX IF NOT EXISTS idx_orders_active
  ON orders(restaurant_id, created_at DESC)
  WHERE status NOT IN ('delivered', 'collected', 'cancelled', 'refunded');

-- Customer lookup by email (for loyalty, GDPR, etc.)
CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders(restaurant_id, customer_email);

-- Reports: daily aggregation
CREATE INDEX IF NOT EXISTS idx_orders_date
  ON orders(restaurant_id, created_at::date, status);

-- Print jobs: pending fetch
CREATE INDEX IF NOT EXISTS idx_print_jobs_queued
  ON print_jobs(restaurant_id, status, priority DESC, created_at ASC)
  WHERE status IN ('queued', 'printing');

-- Loyalty cards lookup
CREATE INDEX IF NOT EXISTS idx_loyalty_email
  ON loyalty_cards(restaurant_id, customer_email);

-- Marketing campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status
  ON marketing_campaigns(restaurant_id, status, created_at DESC);

-- ─────────────────────────────────────
-- 14.1 Materialised View: Daily Order Summaries
-- ─────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_order_summaries AS
SELECT
  restaurant_id,
  created_at::date AS order_date,
  COUNT(*) AS order_count,
  SUM(total) AS total_revenue,
  AVG(total)::INTEGER AS avg_order_value,
  SUM(CASE WHEN order_type = 'delivery' THEN 1 ELSE 0 END) AS delivery_count,
  SUM(CASE WHEN order_type = 'collection' THEN 1 ELSE 0 END) AS collection_count,
  SUM(delivery_fee) AS total_delivery_fees,
  SUM(discount) AS total_discounts,
  SUM(vat_amount) AS total_vat,
  COUNT(CASE WHEN status = 'refunded' THEN 1 END) AS refunded_count
FROM orders
WHERE status NOT IN ('pending', 'cancelled')
GROUP BY restaurant_id, created_at::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summaries_pk
  ON daily_order_summaries(restaurant_id, order_date);

-- Refresh function (call from Supabase cron or pg_cron)
CREATE OR REPLACE FUNCTION refresh_daily_summaries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_order_summaries;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every hour (requires pg_cron extension)
-- SELECT cron.schedule('refresh-daily-summaries', '0 * * * *', 'SELECT refresh_daily_summaries()');

-- ─────────────────────────────────────
-- 14.2 Custom Domains
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_restaurants_custom_domain
  ON restaurants(custom_domain) WHERE custom_domain IS NOT NULL;

-- ─────────────────────────────────────
-- 14.2 Multi-Location Support
-- ─────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS restaurant_ids UUID[] DEFAULT '{}';

-- Backfill: set restaurant_ids from existing restaurant_id
UPDATE users SET restaurant_ids = ARRAY[restaurant_id]
WHERE restaurant_id IS NOT NULL AND (restaurant_ids IS NULL OR restaurant_ids = '{}');

-- ══════════════════════════════════════════════════════════
-- Phase 14 Migration Complete
-- ══════════════════════════════════════════════════════════
