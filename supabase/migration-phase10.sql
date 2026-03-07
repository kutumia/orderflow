-- ══════════════════════════════════════════════════════════
-- Phase 10 Migration — Printer Agent Device Tracking
-- Run AFTER migration-phase9.sql
-- ══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- Printer devices — tracks each installed agent instance
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS printer_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL DEFAULT 'Kitchen Printer',
  printer_name TEXT,
  paper_width INTEGER DEFAULT 80,
  agent_version TEXT,
  os_platform TEXT,
  os_version TEXT,
  last_heartbeat TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'offline', -- online, offline, error
  last_error TEXT,
  total_printed INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_printer_devices_restaurant ON printer_devices(restaurant_id);
CREATE INDEX idx_printer_devices_heartbeat ON printer_devices(last_heartbeat DESC);

-- ─────────────────────────────────────
-- Add device_id to print_jobs for multi-device routing
-- ─────────────────────────────────────
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES printer_devices(id);

-- ─────────────────────────────────────
-- Add printer_agent_version to restaurants for quick version check
-- ─────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS printer_agent_version TEXT;

-- ══════════════════════════════════════════════════════════
-- Phase 10 Migration Complete
-- ══════════════════════════════════════════════════════════
