/**
 * Preload script — exposes safe IPC methods to renderer via contextBridge.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Config
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (key, value) => ipcRenderer.invoke("set-config", key, value),

  // Printers
  getPrinters: () => ipcRenderer.invoke("get-printers"),

  // Test print
  testPrint: () => ipcRenderer.invoke("test-print"),

  // Setup
  setupComplete: (config) => ipcRenderer.invoke("setup-complete", config),

  // Polling
  startPolling: () => ipcRenderer.invoke("start-polling"),
  stopPolling: () => ipcRenderer.invoke("stop-polling"),

  // Status
  getStatus: () => ipcRenderer.invoke("get-status"),

  // Logs
  getLogs: () => ipcRenderer.invoke("get-logs"),

  // Dashboard
  openDashboard: () => ipcRenderer.invoke("open-dashboard"),

  // Auto-update
  installUpdate: () => ipcRenderer.invoke("install-update"),

  // Navigation events from main
  onNavigate: (callback) => {
    ipcRenderer.on("navigate", (_, page) => callback(page));
  },

  // Update events
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", () => callback());
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on("update-downloaded", () => callback());
  },
});
