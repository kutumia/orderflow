export interface PrintJobData {
  device_id: string;
  template?: string; // e.g. 'standard_receipt'
  raw_esc_pos?: string; // Hex string if they want full control
  data?: Record<string, any>; // Render payload for templates
}

export interface PrintJobResponse {
  id: string;
  status: 'queued' | 'printing' | 'completed' | 'failed';
  created_at: string;
}

export class PrintBridge {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, options?: { baseUrl?: string }) {
    if (!apiKey) throw new Error('PrintBridge API Key is required');
    this.apiKey = apiKey;
    // By default points to the OrderFlow/PrintBridge cloud API
    this.baseUrl = options?.baseUrl || 'https://api.printbridge.io/v1';
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PrintBridge API ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  public jobs = {
    /**
     * Dispatch a new print job to a specific device.
     */
    create: async (job: PrintJobData): Promise<PrintJobResponse> => {
      return this.request<PrintJobResponse>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          device_id: job.device_id,
          template: job.template,
          raw_esc_pos: job.raw_esc_pos,
          data: job.data,
        }),
      });
    },

    /**
     * Check the status of a specific print job.
     */
    retrieve: async (jobId: string): Promise<PrintJobResponse> => {
      return this.request<PrintJobResponse>(`/jobs/${encodeURIComponent(jobId)}`);
    },
  };

  public devices = {
    /**
     * List all printers connected to this API key's account.
     */
    list: async (): Promise<{ id: string; name: string; status: string }[]> => {
      return this.request<{ id: string; name: string; status: string }[]>('/devices');
    },
  };
}
