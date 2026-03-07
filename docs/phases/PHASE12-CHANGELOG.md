# Phase 12: PrintBridge Reliability & Multi-Device

**New files:** 3 | **Modified files:** 6

---

## Deployment

1. Run `supabase/migration-phase12.sql` in Supabase SQL Editor
2. Set Twilio env vars (optional, for SMS alerts): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
3. Deploy server
4. Rebuild Electron agent: `cd printer-bridge && npm run build:win`

---

## Features Delivered

### 2.1 — Print Failure SMS/Email Fallback
- `/api/print-fallback` API: sends email + optional SMS (Twilio) to restaurant owner when a print job fails
- Agent calls fallback API after both retry attempts fail
- Tracks `fallback_sent` to prevent duplicate alerts
- Dashboard settings: `print_failure_email` (default on), `print_failure_sms`, `alert_phone`

### 2.2 — Multi-Device Support
- `printer_devices` table tracks multiple devices per restaurant
- `/api/printer-devices` API: list, update (name, categories, connection, default), delete
- Dashboard shows device cards with name, status, connection type, OS, version, stats
- "Set as default printer" per device, inline device rename

### 2.3 — Device Heartbeat Monitoring
- Agent sends heartbeat every 30s; server returns device_id (auto-registration)
- Agent stores device_id and includes it in poll requests for device-specific routing
- Dashboard green/red online/offline status with "last seen X ago"
- Devices marked offline if no heartbeat for 2 minutes

### 2.4 — Print Job Priority Queue
- `priority` field on print_jobs; poll API returns priority DESC, created_at ASC
- Priority badge in dashboard print queue

### 2.5 — Reprint from Dashboard
- Delivered in Phase 11 (reprint button on order cards)

### 2.6 — Remote Printer Diagnostics
- Device card: agent version, OS, printer name, paper width, connection type, total printed/failed

### 2.7 — Network Printer Support
- Agent supports USB and raw TCP/IP (port 9100); setup wizard + settings toggle
- `node-thermal-printer` network interface

### 2.8 — 58mm Paper Support
- Paper width selector (80mm/58mm) in setup + settings; receipt formatter adapts

### 2.9 — Category-Based Routing
- Webhook creates separate print jobs per device based on item→category→device assignment
- Each device has `assigned_categories` UUID array
- Unmatched items go to default device

### 2.10 — API Key Rotation
- Dashboard "Regenerate" with confirmation warning; agent detects 401

---

## New Files

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migration-phase12.sql` | 50 | Priority, fallback, device columns, alert settings |
| `src/app/api/print-fallback/route.ts` | 115 | Email + SMS failure alerts to owner |
| `src/app/api/printer-devices/route.ts` | 105 | Device CRUD (list, update, delete) |

## Modified Files

| File | Changes |
|------|---------|
| `src/app/api/print-heartbeat/route.ts` | Returns device_id for auto-registration |
| `src/app/api/print-jobs/poll/route.ts` | device_id filtering, priority ordering |
| `src/app/api/webhooks/stripe/route.ts` | Category-based device routing |
| `src/app/dashboard/printer/page.tsx` | Multi-device cards, diagnostics |
| `printer-bridge/src/main/poll-service.js` | Fallback call, device_id, device-specific polling |
| `printer-bridge/src/main/printer-service.js` | Network printer TCP/9100 support |
