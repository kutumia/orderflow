-- ══════════════════════════════════════════════════════════
-- Phase 18 Migration — PrintBridge Cloud Extraction
-- Run AFTER migration-phase17.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 18.1 PrintBridge Tenants
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pb_tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  api_key_hash TEXT UNIQUE NOT NULL,
  api_key_prefix TEXT NOT NULL,                -- first 8 chars for display: "pb_live_abc12345..."
  webhook_url TEXT,
  monthly_limit INTEGER DEFAULT 500,           -- jobs/month (0 = unlimited)
  usage_count INTEGER DEFAULT 0,               -- current month usage
  usage_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
  plan TEXT DEFAULT 'free',                    -- free | starter | pro
  is_internal BOOLEAN DEFAULT FALSE,           -- true for OrderFlow's own tenant
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,  -- link to OrderFlow restaurant
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pb_tenants_api_key ON pb_tenants(api_key_hash);

-- ─────────────────────────────────────
-- 18.1 Usage Logs
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pb_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES pb_tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  action TEXT NOT NULL,               -- create_job | update_status | poll | heartbeat
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pb_usage_tenant_date ON pb_usage_logs(tenant_id, created_at DESC);

-- ─────────────────────────────────────
-- 18.3 Webhook Deliveries
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pb_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES pb_tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  event TEXT NOT NULL,                -- job.printed | job.failed
  url TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  attempt INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',      -- pending | delivered | failed
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pb_webhooks_pending ON pb_webhook_deliveries(status, next_retry_at)
  WHERE status = 'pending';

-- ─────────────────────────────────────
-- Add tenant_id to print_jobs for multi-tenant scoping
-- ─────────────────────────────────────
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES pb_tenants(id) ON DELETE SET NULL;

-- ─────────────────────────────────────
-- Create internal OrderFlow tenant (tenant 0)
-- Run after the above tables exist.
-- The api_key_hash is a placeholder — OrderFlow internal calls bypass API key auth.
-- ─────────────────────────────────────
INSERT INTO pb_tenants (name, api_key_hash, api_key_prefix, monthly_limit, is_internal, plan)
VALUES ('OrderFlow Internal', 'internal_no_auth', 'internal', 0, TRUE, 'pro')
ON CONFLICT (api_key_hash) DO NOTHING;

-- ─────────────────────────────────────
-- Atomic usage increment function
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_pb_usage(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE pb_tenants
  SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE id = tenant_uuid;

  -- Reset if past reset date
  UPDATE pb_tenants
  SET usage_count = 1, usage_reset_at = date_trunc('month', NOW()) + INTERVAL '1 month'
  WHERE id = tenant_uuid AND usage_reset_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════
-- Phase 18 Migration Complete
-- ══════════════════════════════════════════════════════════
