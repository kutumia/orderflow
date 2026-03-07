-- ══════════════════════════════════════════════════════════
-- Phase 12 Migration — PrintBridge Reliability & Multi-Device
-- Run AFTER migration-phase11.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 12.1 Print failure fallback tracking
-- ─────────────────────────────────────
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fallback_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fallback_sent_at TIMESTAMPTZ;

-- ─────────────────────────────────────
-- 12.2 Multi-device — enrich printer_devices
-- ─────────────────────────────────────
ALTER TABLE printer_devices
  ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'usb',  -- usb, network
  ADD COLUMN IF NOT EXISTS network_host TEXT,                    -- IP for network printers
  ADD COLUMN IF NOT EXISTS network_port INTEGER DEFAULT 9100,
  ADD COLUMN IF NOT EXISTS assigned_categories UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS error_log JSONB DEFAULT '[]';

-- ─────────────────────────────────────
-- 12.3 Restaurant alert settings
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS print_failure_email BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS print_failure_sms BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_phone TEXT;

-- ─────────────────────────────────────
-- 12.4 Indexes for performance
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_print_jobs_priority
  ON print_jobs(restaurant_id, status, priority DESC, created_at ASC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_printer_devices_online
  ON printer_devices(restaurant_id, is_online);

-- ══════════════════════════════════════════════════════════
-- Phase 12 Migration Complete
-- ══════════════════════════════════════════════════════════
