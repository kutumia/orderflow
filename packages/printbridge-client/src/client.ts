/**
 * PrintBridge Node.js SDK
 *
 * Typed client for the PrintBridge API (/api/pb/v1).
 * Use this from external Node.js services or scripts.
 *
 * Usage:
 *   import { PrintBridge } from "@printbridge/client";
 *   const pb = new PrintBridge("your-api-key");
 *   const job = await pb.jobs.create({ receipt_data: "ESC..." });
 */

export interface PrintJobData {
  device_id?: string;
  receipt_data: string;
  order_id?: string;
  priority?: number;
}

export interface PrintJobResponse {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  device_id?: string;
  order_id?: string;
  receipt_data: string;
  status: "queued" | "printing" | "printed" | "failed";
  priority: number;
  attempts: number;
  error_message?: string;
  created_at: string;
  printed_at?: string;
}

export interface DeviceResponse {
  id: string;
  name: string;
  device_type: string;
  status: string;
  last_seen_at?: string;
  created_at: string;
}

export interface PollJobsOptions {
  status?: "queued" | "printing" | "printed" | "failed";
  limit?: number;
}

export interface UsageResponse {
  count: number;
  limit: number;
}

export class PrintBridgeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    if (!apiKey) throw new Error("PrintBridge API key is required");
    this.apiKey = apiKey;
    this.baseUrl = (options?.baseUrl ?? "https://orderflow.co.uk/api/pb/v1").replace(/\/$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`PrintBridge API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Print job operations.
   */
  public readonly jobs = {
    /**
     * Create a new print job.
     * Returns the created job object including its ID and initial status.
     */
    create: (data: PrintJobData): Promise<{ job: PrintJobResponse }> =>
      this.request<{ job: PrintJobResponse }>("/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    /**
     * Get a specific print job by ID.
     */
    get: (jobId: string): Promise<{ job: PrintJobResponse }> =>
      this.request<{ job: PrintJobResponse }>(`/jobs/${encodeURIComponent(jobId)}`),

    /**
     * Poll for jobs by status (default: queued).
     * Used by print agents to pick up new jobs.
     */
    poll: (options?: PollJobsOptions): Promise<{ jobs: PrintJobResponse[] }> => {
      const params = new URLSearchParams();
      if (options?.status) params.set("status", options.status);
      if (options?.limit) params.set("limit", String(options.limit));
      const qs = params.toString();
      return this.request<{ jobs: PrintJobResponse[] }>(`/poll${qs ? `?${qs}` : ""}`);
    },

    /**
     * Update the status of a print job (used by the print agent after printing).
     */
    updateStatus: (
      jobId: string,
      status: "printing" | "printed" | "failed",
      errorMessage?: string
    ): Promise<{ job: PrintJobResponse }> =>
      this.request<{ job: PrintJobResponse }>(`/jobs/${encodeURIComponent(jobId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, error_message: errorMessage }),
      }),
  };

  /**
   * Printer device operations.
   */
  public readonly devices = {
    /**
     * List all printer devices connected to this API key's account.
     */
    list: (): Promise<{ devices: DeviceResponse[] }> =>
      this.request<{ devices: DeviceResponse[] }>("/devices"),

    /**
     * Send a heartbeat for a device (keeps it marked as online).
     */
    heartbeat: (deviceId: string): Promise<{ ok: boolean }> =>
      this.request<{ ok: boolean }>("/heartbeat", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId }),
      }),
  };

  /**
   * Usage and quota information.
   */
  public readonly usage = {
    /**
     * Get monthly usage and limit for this tenant.
     */
    get: (): Promise<UsageResponse> =>
      this.request<UsageResponse>("/usage"),
  };

  /**
   * Verify a webhook signature from PrintBridge.
   * Call this in your webhook handler to confirm the payload is authentic.
   *
   * @param rawBody   The raw request body string (do not parse first)
   * @param signature The X-PrintBridge-Signature header value
   * @param secret    Your tenant's webhook_secret from the PrintBridge dashboard
   */
  public static verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) return false;
    try {
      // Node.js only — crypto is a built-in
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require("crypto") as typeof import("crypto");
      const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }
}

// Default export for convenience
export default PrintBridgeClient;
