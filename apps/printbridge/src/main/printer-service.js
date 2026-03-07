/**
 * PrinterService — handles printer enumeration and ESC/POS printing.
 *
 * Supports:
 *   - USB thermal printers via node-thermal-printer
 *   - Network printers via raw TCP (IP:9100)
 *   - 80mm (48 char) and 58mm (32 char) paper
 *   - Console fallback for testing
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const net = require("net");
const execAsync = promisify(exec);

/** Allow only safe characters for use in shell commands (printer names, etc.) */
function sanitizeForShell(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\w\s\-_.]/g, "").trim().slice(0, 128) || "Printer";
}

class PrinterService {
  constructor(store) {
    this.store = store;
  }

  updateConfig() {
    // Re-read config from store (called after setup)
  }

  /**
   * List installed printers on the system.
   */
  async listPrinters() {
    const platform = process.platform;
    try {
      if (platform === "win32") return await this._listPrintersWindows();
      return await this._listPrintersUnix();
    } catch (err) {
      console.error("Failed to list printers:", err.message);
      return [];
    }
  }

  async _listPrintersWindows() {
    try {
      const { stdout } = await execAsync(
        'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName | ConvertTo-Json"',
        { timeout: 10000 }
      );
      const parsed = JSON.parse(stdout);
      const printers = Array.isArray(parsed) ? parsed : [parsed];
      return printers.map((p) => ({
        name: p.Name,
        driver: p.DriverName || "",
        port: p.PortName || "",
        isDefault: false,
      }));
    } catch {
      try {
        const { stdout } = await execAsync("wmic printer get Name,Default /format:csv", { timeout: 10000 });
        const lines = stdout.trim().split("\n").filter((l) => l.trim());
        return lines.slice(1).map((line) => {
          const parts = line.trim().split(",");
          return { name: parts[2] || "", driver: "", port: "", isDefault: parts[1] === "TRUE" };
        }).filter((p) => p.name);
      } catch { return []; }
    }
  }

  async _listPrintersUnix() {
    try {
      const { stdout } = await execAsync("lpstat -p 2>/dev/null || echo ''", { timeout: 5000 });
      return stdout.split("\n")
        .map((line) => line.match(/printer\s+(\S+)/))
        .filter(Boolean)
        .map((m) => ({ name: m[1], driver: "", port: "", isDefault: false }));
    } catch { return []; }
  }

  /**
   * Print receipt text to the configured printer.
   * Supports USB (printer name) and network (TCP/IP) connections.
   */
  async print(receiptText) {
    const connectionType = this.store.get("connectionType") || "usb";

    if (connectionType === "network") {
      return this._printNetwork(receiptText);
    }
    return this._printUSB(receiptText);
  }

  /**
   * Print via USB/local printer using node-thermal-printer.
   */
  async _printUSB(receiptText) {
    const printerName = this.store.get("printerName");
    if (!printerName) throw new Error("No printer configured");

    try {
      const ThermalPrinter = require("node-thermal-printer").printer;
      const PrinterTypes = require("node-thermal-printer").types;

      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `printer:${printerName}`,
        width: this.store.get("paperWidth") === 58 ? 32 : 48,
        characterSet: "CHARCODE_UK",
        removeSpecialCharacters: false,
        options: { timeout: 5000 },
      });

      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) throw new Error(`Printer "${printerName}" is not connected`);

      printer.raw(Buffer.from(receiptText, "utf-8"));
      await printer.execute();
      printer.clear();
      return true;
    } catch (err) {
      if (process.platform === "win32") {
        return this._printWindowsFallback(receiptText, printerName);
      }
      throw err;
    }
  }

  /**
   * Print via network (raw TCP socket to port 9100).
   * This is the standard RAW protocol used by most network receipt printers.
   */
  async _printNetwork(receiptText) {
    const host = this.store.get("networkHost");
    const port = this.store.get("networkPort") || 9100;

    if (!host) throw new Error("Network host not configured");

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Network printer timeout (${host}:${port})`));
      }, 10000);

      socket.connect(port, host, () => {
        socket.write(Buffer.from(receiptText, "utf-8"), (err) => {
          clearTimeout(timeout);
          if (err) {
            socket.destroy();
            reject(new Error(`Write failed: ${err.message}`));
          } else {
            socket.end();
            resolve(true);
          }
        });
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Network printer error: ${err.message}`));
      });

      socket.on("close", () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Windows fallback: write to temp file, print via PowerShell.
   */
  async _printWindowsFallback(receiptText, printerName) {
    const fs = require("fs");
    const os = require("os");
    const safeName = sanitizeForShell(printerName);
    const tmpFile = require("path").join(os.tmpdir(), `orderflow-receipt-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, receiptText, "utf-8");

    try {
      const escapedPath = tmpFile.replace(/'/g, "''");
      await execAsync(
        `powershell -Command "Get-Content '${escapedPath}' | Out-Printer '${safeName}'"`,
        { timeout: 15000 }
      );
      return true;
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
    }
  }

  /**
   * Send a test print to verify connectivity.
   */
  async testPrint() {
    const paperWidth = this.store.get("paperWidth") || 80;
    const w = paperWidth === 58 ? 32 : 48;
    const line = "=".repeat(w);
    const connectionType = this.store.get("connectionType") || "usb";
    const printerName = this.store.get("printerName") || "N/A";
    const host = this.store.get("networkHost") || "N/A";
    const port = this.store.get("networkPort") || 9100;

    try {
      const ThermalPrinter = require("node-thermal-printer").printer;
      const PrinterTypes = require("node-thermal-printer").types;

      const iface = connectionType === "network"
        ? `tcp://${host}:${port}`
        : `printer:${printerName}`;

      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: iface,
        width: w,
        characterSet: "CHARCODE_UK",
      });

      printer.alignCenter();
      printer.bold(true);
      printer.println("OrderFlow Printer");
      printer.bold(false);
      printer.println("TEST PRINT");
      printer.drawLine();
      printer.println(new Date().toLocaleString("en-GB"));
      printer.drawLine();
      printer.alignLeft();
      printer.println(`Connection: ${connectionType}`);
      if (connectionType === "network") {
        printer.println(`Host: ${host}:${port}`);
      } else {
        printer.println(`Printer: ${printerName}`);
      }
      printer.println(`Paper: ${paperWidth}mm (${w} chars)`);
      printer.drawLine();
      printer.alignCenter();
      printer.println("If you can read this,");
      printer.println("printing is working!");
      printer.drawLine();
      printer.cut();

      await printer.execute();
      printer.clear();
      return true;
    } catch (err) {
      // Fallback for USB on Windows
      if (connectionType === "usb" && process.platform === "win32") {
        const text = [line, center("OrderFlow Printer", w), center("TEST PRINT", w), line, "",
          center(new Date().toLocaleString("en-GB"), w), "", `Printer: ${printerName}`,
          `Paper: ${paperWidth}mm`, "", line, center("Printing works!", w), line, "", ""].join("\n");
        return this._printWindowsFallback(text, printerName);
      }
      throw err;
    }
  }
}

function center(text, w) {
  if (text.length >= w) return text;
  return " ".repeat(Math.floor((w - text.length) / 2)) + text;
}

module.exports = { PrinterService };
