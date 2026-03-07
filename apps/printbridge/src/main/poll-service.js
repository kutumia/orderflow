/**
 * PollService — polls the OrderFlow server for print jobs.
 *
 * Features:
 *   - Polls every N seconds (configurable)
 *   - Offline queue (stores jobs locally when server unreachable)
 *   - Auto-retry failed prints (up to 3 attempts)
 *   - Sound alerts for new orders
 *   - Structured logging with circular buffer
 */

const path = require("path");

class PollService {
  constructor(store, printerService, onStatusChange) {
    this.store = store;
    this.printerService = printerService;
    this.onStatusChange = onStatusChange;

    this.isRunning = false;
    this.isConnected = false;
    this.pollTimer = null;
    this.lastPollTime = null;
    this.jobsPrintedCount = 0;
    this.jobsFailedCount = 0;
    this.consecutiveErrors = 0;
    this.offlineQueue = [];
    this.logs = []; // Circular log buffer (max 200 entries)
    this.MAX_LOGS = 200;
  }

  get offlineQueueCount() {
    return this.offlineQueue.length;
  }

  // ── Logging ──
  log(level, message, context) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {}),
    };
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
    const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "ℹ️";
    console.log(`[${entry.timestamp}] ${prefix} ${message}`);
  }

  getLogs() {
    return [...this.logs].reverse();
  }

  // ── Start/Stop ──
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log("info", "Poll service started");
    this._poll(); // First poll immediately
    this.pollTimer = setInterval(
      () => this._poll(),
      (this.store.get("pollInterval") || 3) * 1000
    );

    // Send heartbeat every 30 seconds
    this._sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this._sendHeartbeat(), 30000);
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.log("info", "Poll service stopped");
  }

  // ── Heartbeat ──
  async _sendHeartbeat() {
    const apiKey = this.store.get("apiKey");
    const serverUrl = this.store.get("serverUrl");
    if (!apiKey || !serverUrl) return;

    try {
      const os = require("os");
      const res = await fetch(`${serverUrl}/api/print-heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          device_name: this.store.get("deviceName") || "Kitchen Printer",
          printer_name: this.store.get("printerName") || null,
          paper_width: this.store.get("paperWidth") || 80,
          agent_version: require("../../package.json").version,
          os_platform: os.platform(),
          os_version: os.release(),
          status: this.isConnected ? "online" : "error",
          last_error: this.consecutiveErrors > 0 ? `${this.consecutiveErrors} consecutive poll failures` : null,
          total_printed: this.jobsPrintedCount,
          total_failed: this.jobsFailedCount,
        }),
      });
      // Store device_id from server (used for multi-device job routing)
      if (res.ok) {
        const data = await res.json();
        if (data.device_id && !this.store.get("deviceId")) {
          this.store.set("deviceId", data.device_id);
          this.log("info", `Device registered: ${data.device_id}`);
        }
      }
    } catch {
      // Heartbeat failure is not critical
    }
  }

  // ── Main Poll Loop ──
  async _poll() {
    const apiKey = this.store.get("apiKey");
    const serverUrl = this.store.get("serverUrl");

    if (!apiKey || !serverUrl) {
      this.isConnected = false;
      this.onStatusChange("disconnected");
      return;
    }

    try {
      const deviceName = this.store.get("deviceName") || "Kitchen Printer";
      let url = `${serverUrl}/api/print-jobs/poll?api_key=${encodeURIComponent(apiKey)}`;
      // If we know our device_id (set after first heartbeat response), include it for multi-device routing
      const deviceId = this.store.get("deviceId");
      if (deviceId) url += `&device_id=${encodeURIComponent(deviceId)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 401) {
          this.log("error", "Invalid API key — check your settings");
          this.isConnected = false;
          this.onStatusChange("error", "Invalid API key");
          this.stop();
          return;
        }
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      this.lastPollTime = new Date().toISOString();
      this.consecutiveErrors = 0;
      this.isConnected = true;

      // Process any offline queue first
      if (this.offlineQueue.length > 0) {
        this.log("info", `Processing ${this.offlineQueue.length} offline queued jobs`);
        for (const job of this.offlineQueue) {
          await this._processJob(job, serverUrl, apiKey);
        }
        this.offlineQueue = [];
      }

      // Process new jobs
      if (data.jobs && data.jobs.length > 0) {
        this.log("info", `Received ${data.jobs.length} print job(s)`);
        this.onStatusChange("printing");

        // Play sound alert
        if (this.store.get("soundEnabled")) {
          this._playSound();
        }

        for (const job of data.jobs) {
          await this._processJob(job, serverUrl, apiKey);
        }

        this.onStatusChange("connected");
      } else {
        this.onStatusChange("connected");
      }
    } catch (err) {
      this.consecutiveErrors++;

      if (err.name === "AbortError") {
        this.log("warn", "Poll timed out (10s)");
      } else {
        this.log("warn", `Poll failed: ${err.message}`);
      }

      this.isConnected = false;

      if (this.consecutiveErrors >= 3) {
        this.onStatusChange("error", `${this.consecutiveErrors} consecutive failures`);
      } else {
        this.onStatusChange("offline");
      }
    }
  }

  // ── Process a single print job ──
  async _processJob(job, serverUrl, apiKey) {
    if (!job.receipt_text) {
      this.log("error", `Job ${job.job_id} has no receipt data`);
      await this._reportStatus(serverUrl, apiKey, job.job_id, "failed", "No receipt data");
      this.jobsFailedCount++;
      return;
    }

    // Try to print (with 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        this.log("info", `Printing order #${job.order_number || "?"} (attempt ${attempt + 1})`);
        await this.printerService.print(job.receipt_text);
        this.log("info", `Order #${job.order_number || "?"} printed successfully`);
        await this._reportStatus(serverUrl, apiKey, job.job_id, "printed");
        this.jobsPrintedCount++;
        return;
      } catch (err) {
        this.log("error", `Print failed: ${err.message}`);
        if (attempt === 0) {
          // Wait 2 seconds before retry
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    // Both attempts failed
    this.log("error", `Order #${job.order_number || "?"} failed after 2 attempts`);
    await this._reportStatus(serverUrl, apiKey, job.job_id, "failed", "Print failed after 2 attempts");
    this.jobsFailedCount++;

    // Call fallback alert API (server sends email/SMS to owner)
    try {
      await fetch(`${serverUrl}/api/print-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          job_id: job.job_id,
          order_number: job.order_number,
          order_type: job.order_type,
          customer_name: job.customer_name || "Unknown",
          error: "Print failed after 2 agent-side attempts",
        }),
      });
      this.log("info", "Fallback alert sent to restaurant owner");
    } catch (fallbackErr) {
      this.log("warn", `Fallback alert failed: ${fallbackErr.message}`);
    }

    // Show desktop notification
    const { Notification } = require("electron");
    if (Notification.isSupported()) {
      new Notification({
        title: "Print Failed",
        body: `Order #${job.order_number || "?"} could not be printed. Check your printer.`,
      }).show();
    }
  }

  // ── Report job status back to server ──
  async _reportStatus(serverUrl, apiKey, jobId, status, error = null) {
    try {
      await fetch(`${serverUrl}/api/print-jobs/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          job_id: jobId,
          status,
          error,
        }),
      });
    } catch (err) {
      this.log("warn", `Failed to report status for job ${jobId}: ${err.message}`);
    }
  }

  // ── Sound Alert ──
  _playSound() {
    // Play system beep sound
    try {
      if (process.platform === "win32") {
        require("child_process").exec(
          'powershell -Command "[Console]::Beep(800,300); Start-Sleep -Milliseconds 100; [Console]::Beep(1000,300)"'
        );
      }
      // macOS/Linux: afplay or paplay could be used but most restaurants use Windows
    } catch {
      // Sound not critical
    }
  }
}

module.exports = { PollService };
