-- ══════════════════════════════════════
-- Phase 4 Migration: Kitchen Display & Print Bridge
-- Run this if you already deployed Phases 1-3
-- ══════════════════════════════════════

-- Add printer API key to restaurants
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_api_key TEXT UNIQUE;

-- Update print_jobs status values
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_status_check 
  CHECK (status IN ('queued', 'printing', 'printed', 'failed'));

-- Rename sent_at to printed_at if exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_jobs' AND column_name = 'sent_at') THEN
    ALTER TABLE print_jobs RENAME COLUMN sent_at TO printed_at;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_jobs' AND column_name = 'printed_at') THEN
    ALTER TABLE print_jobs ADD COLUMN printed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Drop fallback_sent if exists (no longer used)
ALTER TABLE print_jobs DROP COLUMN IF EXISTS fallback_sent;
