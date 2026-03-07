# Phase 10: OrderFlow Printer Agent (Electron MVP)

**Version:** 1.0.0
**New files:** 12 | **Modified files:** 2

---

## What's New

### Electron Desktop App (`printer-bridge/`)
A branded Windows desktop app that restaurant owners download, install in 2 clicks, and never touch again. Replaces the old Node.js command-line `agent.js`.

| Component | File | Description |
|-----------|------|-------------|
| Main process | `src/main/index.js` | System tray, window management, auto-update, IPC handlers |
| Preload | `src/main/preload.js` | Secure contextBridge IPC between main and renderer |
| Printer service | `src/main/printer-service.js` | Printer enumeration (Win/Mac/Linux), ESC/POS printing, test print |
| Poll service | `src/main/poll-service.js` | Server polling, offline queue, retry logic, sound alerts, heartbeat, logging |
| UI | `src/renderer/index.html` | Setup wizard (4 steps), status dashboard, settings, log viewer |
| Icons | `assets/tray-*.png` | System tray icons (green/yellow/red/default) |
| Config | `package.json` | Electron + electron-builder + NSIS installer config |
| Docs | `README.md` | Setup, build, and architecture documentation |

### Server-Side Changes

| File | Description |
|------|-------------|
| `supabase/migration-phase10.sql` | `printer_devices` table, `device_id` on print_jobs |
| `src/app/api/print-heartbeat/route.ts` | Heartbeat API — device status tracking |
| `src/app/dashboard/printer/page.tsx` | Upgraded — branded download section, device status, connection indicator |

---

## Deployment

### 1. Run Migration
```sql
-- In Supabase SQL Editor:
-- supabase/migration-phase10.sql
```

### 2. Copy Server Files
- `src/app/api/print-heartbeat/route.ts` (NEW)
- `src/app/dashboard/printer/page.tsx` (MODIFIED)
- `supabase/migration-phase10.sql` (NEW)

### 3. Build the Electron App
```bash
cd printer-bridge
npm install
npm run build:win   # Creates dist/OrderFlow Printer Setup.exe
```

### 4. Host the Installer
Upload `dist/OrderFlow Printer Setup.exe` to your CDN or serve from `/public/downloads/`.
Update the download link in `dashboard/printer/page.tsx` if needed.

---

## Key Features

| Feature | Status |
|---------|--------|
| 4-step setup wizard | ✅ |
| System tray (green/yellow/red) | ✅ |
| Printer enumeration (Win/Mac/Linux) | ✅ |
| ESC/POS thermal printing | ✅ |
| Poll every 3 seconds | ✅ |
| Retry failed prints (1 retry after 2s) | ✅ |
| Auto-start on boot | ✅ |
| Offline queue (survives network drops) | ✅ |
| Sound alerts on new orders | ✅ |
| Log viewer (200 entries) | ✅ |
| Auto-updater (GitHub Releases) | ✅ |
| Device heartbeat (every 30s) | ✅ |
| 80mm + 58mm paper support | ✅ |
| Dashboard device status indicator | ✅ |
| API key generation + regeneration | ✅ |
| NSIS Windows installer config | ✅ |
