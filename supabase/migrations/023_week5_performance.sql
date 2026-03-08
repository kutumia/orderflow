-- Week 5 Performance Migrations
-- P-2: get_platform_stats() — DB-level GMV aggregate used by admin stats endpoint
-- P-5: Additional indexes for engagement cron hot paths

-- ─────────────────────────────────────────────────────────────────────────────
-- P-2: Platform stats aggregate function
--
-- Called by GET /api/admin?type=stats to avoid fetching all order rows into JS.
-- Returns total GMV (sum of completed order totals) as a single row.
-- "Completed" means any status that represents revenue: confirmed, preparing,
-- ready, out_for_delivery, delivered, collected.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  total_gmv        BIGINT,
  total_orders     BIGINT,
  active_restaurants BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(o.total), 0)::BIGINT                                          AS total_gmv,
    COUNT(o.id)::BIGINT                                                         AS total_orders,
    (SELECT COUNT(*)::BIGINT FROM restaurants WHERE is_active = TRUE)          AS active_restaurants
  FROM orders o
  WHERE o.status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'collected');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-5: Performance indexes for engagement cron and loyalty hot paths
--
-- The engagement cron runs once daily for every active restaurant and issues
-- queries filtered by restaurant_id + marketing_opt_out + gdpr_deleted for
-- "we miss you" emails, and by restaurant_id + stamps_earned for loyalty.
-- Without these indexes each cron run does full table scans on customers
-- and loyalty_cards.
-- ─────────────────────────────────────────────────────────────────────────────

-- customers: covers the WHERE clause in processWeMissYou and processReorderReminders
CREATE INDEX IF NOT EXISTS idx_customers_engagement
  ON customers (restaurant_id, marketing_opt_out, gdpr_deleted)
  WHERE gdpr_deleted = FALSE;

-- automation_logs: covers the duplicate-check COUNT in processWeMissYou / processLoyaltyReady
CREATE INDEX IF NOT EXISTS idx_automation_logs_dedup
  ON automation_logs (restaurant_id, customer_email, trigger_type, created_at DESC);

-- loyalty_cards: covers the full-stamp-card lookup in processLoyaltyReady
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_stamps
  ON loyalty_cards (restaurant_id, stamps_earned);

-- orders: covers the admin stats COUNT for non-pending orders
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status)
  WHERE status NOT IN ('pending', 'cancelled');
