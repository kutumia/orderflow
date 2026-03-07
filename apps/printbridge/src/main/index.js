/**
 * OrderFlow Printer — Electron Main Process
 *
 * System tray app that polls for print jobs and sends them to a thermal printer.
 * Runs silently in the background, auto-starts on boot, auto-updates.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const Store = require("electron-store");
const { autoUpdater } = require("electron-updater");
const { PrinterService } = require("./printer-service");
const { PollService } = require("./poll-service");

// ── Config store (persists between restarts) ──
const store = new Store({
  defaults: {
    apiKey: "",
    serverUrl: "",
    printerName: "",
    paperWidth: 80,
    soundEnabled: true,
    soundVolume: 50,
    autoStart: true,
    openAtLogin: true,
    pollInterval: 3,
    setupComplete: false,
  },
});

// ── Globals ──
let mainWindow = null;
let tray = null;
let pollService = null;
let printerService = null;
let isQuitting = false;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ══════════════════════════════════════
// App Lifecycle
// ══════════════════════════════════════

app.whenReady().then(async () => {
  // Auto-start on boot
  app.setLoginItemSettings({
    openAtLogin: store.get("openAtLogin"),
    openAsHidden: true,
  });

  createTray();
  printerService = new PrinterService(store);
  pollService = new PollService(store, printerService, updateTrayStatus);

  if (store.get("setupComplete")) {
    // Already configured — start polling silently
    pollService.start();
    updateTrayStatus("connected");
  } else {
    // First run — show setup wizard
    createWindow("setup");
  }

  // Check for updates (silently)
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.error("Auto-update check failed:", e.message);
  }

  // Check for updates every 6 hours
  setInterval(() => {
    try { autoUpdater.checkForUpdatesAndNotify(); } catch (e) { /* ignore */ }
  }, 6 * 60 * 60 * 1000);
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", (e) => {
  // Don't quit — keep running in tray
});

// ══════════════════════════════════════
// Window Management
// ══════════════════════════════════════

function createWindow(page = "setup") {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("navigate", page);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "OrderFlow Printer",
    icon: getTrayIcon("default"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Dev tools in dev mode
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("navigate", page);
  });
}

// ══════════════════════════════════════
// System Tray
// ══════════════════════════════════════

function getTrayIcon(status) {
  // In production, use proper .ico/.png icons from assets/
  // For now, use built-in Electron template
  const iconName =
    status === "connected" ? "tray-green.png"
    : status === "error" ? "tray-red.png"
    : status === "printing" ? "tray-yellow.png"
    : "tray-default.png";

  const iconPath = path.join(__dirname, "../assets", iconName);
  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback to a 16x16 empty icon
    return nativeImage.createEmpty();
  }
}

function createTray() {
  tray = new Tray(getTrayIcon("default"));
  tray.setToolTip("OrderFlow Printer");
  updateTrayMenu();

  tray.on("double-click", () => {
    createWindow(store.get("setupComplete") ? "status" : "setup");
  });
}

function updateTrayStatus(status, message) {
  if (!tray) return;

  const tooltipMap = {
    connected: "OrderFlow Printer — Connected",
    error: `OrderFlow Printer — Error: ${message || "Check settings"}`,
    printing: "OrderFlow Printer — Printing...",
    offline: "OrderFlow Printer — Offline (queuing jobs)",
    disconnected: "OrderFlow Printer — Not configured",
  };

  tray.setToolTip(tooltipMap[status] || "OrderFlow Printer");
  tray.setImage(getTrayIcon(status));
  updateTrayMenu(status);
}

function updateTrayMenu(status) {
  const template = [
    {
      label: `OrderFlow Printer v${app.getVersion()}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: status === "connected" ? "✅ Connected" : status === "error" ? "❌ Error" : "⚪ Not connected",
      enabled: false,
    },
    {
      label: pollService?.offlineQueueCount > 0
        ? `📋 ${pollService.offlineQueueCount} jobs queued`
        : "No queued jobs",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Test Print",
      click: async () => {
        try {
          await printerService.testPrint();
          dialog.showMessageBox({ message: "Test print sent!", type: "info" });
        } catch (err) {
          dialog.showErrorBox("Print Failed", err.message);
        }
      },
    },
    {
      label: "Settings",
      click: () => createWindow("settings"),
    },
    {
      label: "View Logs",
      click: () => createWindow("logs"),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        if (pollService) pollService.stop();
        app.quit();
      },
    },
  ];

  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate(template));
  }
}

// ══════════════════════════════════════
// IPC Handlers (Renderer ↔ Main)
// ══════════════════════════════════════

// Config
ipcMain.handle("get-config", () => store.store);
ipcMain.handle("set-config", (_, key, value) => {
  store.set(key, value);
  if (key === "openAtLogin") {
    app.setLoginItemSettings({ openAtLogin: value, openAsHidden: true });
  }
  return true;
});

// Printer enumeration
ipcMain.handle("get-printers", async () => {
  return printerService.listPrinters();
});

// Test print
ipcMain.handle("test-print", async () => {
  try {
    await printerService.testPrint();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Setup complete
ipcMain.handle("setup-complete", async (_, config) => {
  store.set("apiKey", config.apiKey);
  store.set("serverUrl", config.serverUrl);
  store.set("printerName", config.printerName);
  store.set("paperWidth", config.paperWidth || 80);
  store.set("deviceName", config.deviceName || "Kitchen Printer");
  store.set("connectionType", config.connectionType || "usb");
  store.set("networkHost", config.networkHost || "");
  store.set("networkPort", config.networkPort || 9100);
  store.set("setupComplete", true);

  printerService.updateConfig();
  pollService.start();
  updateTrayStatus("connected");

  if (mainWindow) mainWindow.hide();
  return true;
});

// Start/stop polling
ipcMain.handle("start-polling", () => { pollService.start(); return true; });
ipcMain.handle("stop-polling", () => { pollService.stop(); return true; });

// Get status
ipcMain.handle("get-status", () => ({
  isPolling: pollService?.isRunning || false,
  connected: pollService?.isConnected || false,
  lastPollTime: pollService?.lastPollTime || null,
  jobsPrinted: pollService?.jobsPrintedCount || 0,
  jobsFailed: pollService?.jobsFailedCount || 0,
  offlineQueue: pollService?.offlineQueueCount || 0,
  consecutiveErrors: pollService?.consecutiveErrors || 0,
}));

// Get logs
ipcMain.handle("get-logs", () => {
  return pollService?.getLogs() || [];
});

// Regenerate API key (opens dashboard in browser)
ipcMain.handle("open-dashboard", () => {
  const serverUrl = store.get("serverUrl");
  if (serverUrl) {
    shell.openExternal(`${serverUrl}/dashboard/printer`);
  }
});

// Auto-updater events
autoUpdater.on("update-available", () => {
  if (mainWindow) mainWindow.webContents.send("update-available");
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindow) mainWindow.webContents.send("update-downloaded");
  updateTrayMenu("connected");
  // Add "Restart to update" menu item
});

ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall();
});
