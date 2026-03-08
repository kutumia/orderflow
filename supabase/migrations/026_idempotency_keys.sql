-- Migration: 026_idempotency_keys.sql
-- Description: Add idempotency_keys table for checkout/refund deduplication
-- Author: OrderFlow Platform Team
-- Date: 2026-03-08
-- Risk: Low
-- Reversibility: Reversible
-- Rollback: DROP TABLE IF EXISTS idempotency_keys;

-- ── Forward migration ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key              TEXT NOT NULL,
  scope            TEXT NOT NULL,
  response_status  INT NOT NULL,
  response_body    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, scope)
);

COMMENT ON TABLE idempotency_keys IS
  'Stores idempotency key results for checkout, refund, and other critical write operations. TTL = 24 hours.';

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys(created_at);

-- Cleanup function (called by scheduled cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM idempotency_keys
  WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS
  'Removes idempotency keys older than 24 hours. Returns number of rows deleted.';

-- Enable RLS (keys are application-managed, not user-managed)
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Service role (app) can do everything; no direct user access
CREATE POLICY "Service role only" ON idempotency_keys
  FOR ALL USING (auth.role() = 'service_role');
