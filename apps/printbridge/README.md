# OrderFlow Printer

Desktop app that automatically prints kitchen orders from OrderFlow to your thermal receipt printer.

## For Restaurant Owners

1. Go to **Dashboard → Printer** and generate an API key
2. Download the installer from the dashboard
3. Run the installer and follow the setup wizard
4. Orders will start printing automatically

The app runs silently in your system tray and starts automatically when your PC boots.

## For Developers

### Prerequisites

- Node.js 18+
- Windows 10/11 (primary target), macOS, or Linux

### Development

```bash
cd printer-bridge
npm install
npm start        # Run in development mode
npm run dev      # Run with DevTools open
```

### Building the Installer

```bash
npm run build:win   # Windows .exe installer (NSIS)
npm run build:mac   # macOS .dmg
```

Output goes to `dist/`.

### Architecture

```
printer-bridge/
├── src/
│   ├── main/
│   │   ├── index.js           # Electron main process (tray, windows, IPC)
│   │   ├── preload.js         # Secure IPC bridge (contextBridge)
│   │   ├── printer-service.js # Printer enumeration + ESC/POS printing
│   │   └── poll-service.js    # Server polling, offline queue, retry, logging
│   └── renderer/
│       └── index.html         # Setup wizard + status/settings/logs UI
├── assets/
│   └── tray-*.png             # System tray icons (green/yellow/red)
└── package.json               # Electron + electron-builder config
```

### Key Features

- **Setup wizard** — 4-step guided configuration (API key → printer → test → done)
- **System tray** — green/yellow/red status indicator, context menu
- **Auto-start** — runs on Windows boot via `app.setLoginItemSettings`
- **Auto-update** — checks GitHub Releases every 6 hours, installs silently
- **Offline queue** — stores up to 50 jobs when server is unreachable
- **Retry logic** — retries failed prints once after 2 seconds
- **Sound alerts** — system beep on new orders (Windows)
- **Log viewer** — last 200 log entries in-app
- **Heartbeat** — reports device status to server every 30 seconds
- **Multi-platform printing** — node-thermal-printer (Epson/Star), PowerShell fallback on Windows

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/print-jobs/poll` | GET | Fetch queued print jobs |
| `/api/print-jobs/poll` | POST | Report job completion/failure |
| `/api/print-heartbeat` | POST | Send device heartbeat |
| `/api/print-heartbeat` | GET | Verify API key connectivity |

### Code Signing (Production)

For Windows SmartScreen to not block the installer:
1. Purchase EV Code Signing certificate from SSL.com (~£350/yr)
2. Set `CSC_LINK` and `CSC_KEY_PASSWORD` env vars
3. Build with `npm run build:win`
