/**
 * PrintBridge SDK — internal abstraction for all print operations.
 *
 * All OrderFlow code and external API endpoints call this SDK
 * instead of querying print_jobs directly.
 */

import { getSupabaseAdmin } from "@orderflow/core-infra";
import crypto from "crypto";

const supabaseAdmin = getSupabaseAdmin();

export * from "./receipt";
export * from "./template";

// ── Types ──

export interface PrintJob {
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

export interface TenantInfo {
  id: string;
  name: string;
  webhook_url?: string;
  webhook_secret?: string;
  monthly_limit: number;
  usage_count: number;
  is_internal: boolean;
  plan: string;
  restaurant_id?: string;
}

// ── Tenant Resolution ──

const INTERNAL_TENANT_CACHE: { id?: string } = {};

async function getInternalTenantId(): Promise<string> {
  if (INTERNAL_TENANT_CACHE.id) return INTERNAL_TENANT_CACHE.id;
  const { data } = await supabaseAdmin
    .from("pb_tenants")
    .select("id")
    .eq("is_internal", true)
    .single();
  INTERNAL_TENANT_CACHE.id = data?.id || "";
  return INTERNAL_TENANT_CACHE.id || "";
}

/**
 * Resolve tenant from API key hash.
 */
export async function resolveTenant(apiKeyHash: string): Promise<TenantInfo | null> {
  const { data } = await supabaseAdmin
    .from("pb_tenants")
    .select("*")
    .eq("api_key_hash", apiKeyHash)
    .single();
  return data || null;
}

/**
 * Resolve tenant from raw API key (hashes it first).
 */
export async function resolveTenantByKey(apiKey: string): Promise<TenantInfo | null> {
  const hash = hashApiKey(apiKey);
  return resolveTenant(hash);
}

/**
 * Resolve tenant from restaurant_id (for internal OrderFlow use).
 */
export async function resolveTenantByRestaurant(restaurantId: string): Promise<TenantInfo | null> {
  // First check if restaurant has its own tenant
  const { data: direct } = await supabaseAdmin
    .from("pb_tenants")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();
  if (direct) return direct;

  // Fall back to internal tenant
  const internalId = await getInternalTenantId();
  if (!internalId) return null;
  const { data } = await supabaseAdmin
    .from("pb_tenants")
    .select("*")
    .eq("id", internalId)
    .single();
  return data || null;
}

// ── API Key Utilities ──

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `pb_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 16);
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ── Job Operations ──

/**
 * Create a print job.
 */
export async function createJob(params: {
  tenantId: string;
  restaurantId: string;
  orderId?: string;
  deviceId?: string;
  receiptData: string;
  priority?: number;
}): Promise<PrintJob | null> {
  // Check rate limit
  const tenant = await getTenant(params.tenantId);
  if (tenant && tenant.monthly_limit > 0 && tenant.usage_count >= tenant.monthly_limit) {
    throw new Error("Monthly job limit exceeded");
  }

  const { data, error } = await supabaseAdmin
    .from("print_jobs")
    .insert({
      tenant_id: params.tenantId,
      restaurant_id: params.restaurantId,
      order_id: params.orderId || null,
      device_id: params.deviceId || null,
      receipt_data: params.receiptData,
      priority: params.priority || 0,
      status: "queued",
      attempts: 0,
    })
    .select()
    .single();

  if (error || !data) return null;

  // Increment usage
  await supabaseAdmin.rpc("increment_pb_usage", { tenant_uuid: params.tenantId });

  // Log
  await logUsage(params.tenantId, data.id, "create_job");

  return data;
}

/**
 * Poll for queued jobs (called by print agent).
 */
export async function pollJobs(params: {
  tenantId: string;
  restaurantId: string;
  deviceId?: string;
  limit?: number;
}): Promise<PrintJob[]> {
  let query = supabaseAdmin
    .from("print_jobs")
    .select("*")
    .eq("restaurant_id", params.restaurantId)
    .in("status", ["queued", "printing"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(params.limit || 10);

  if (params.deviceId) {
    query = query.or(`device_id.eq.${params.deviceId},device_id.is.null`);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Update job status.
 */
export async function updateJobStatus(params: {
  jobId: string;
  tenantId: string;
  status: "printing" | "printed" | "failed";
  errorMessage?: string;
}): Promise<PrintJob | null> {
  const updates: any = {
    status: params.status,
    attempts: undefined, // will be set via raw SQL if needed
  };

  if (params.status === "printed") {
    updates.printed_at = new Date().toISOString();
  }
  if (params.status === "failed" && params.errorMessage) {
    updates.error_message = params.errorMessage;
  }

  // [P2 FIX] Scope update by tenant_id — previously tenantId was accepted as a
  // parameter but never used in the query filter, allowing any authenticated
  // PrintBridge agent to update print jobs belonging to other tenants.
  const { data } = await supabaseAdmin
    .from("print_jobs")
    .update(updates)
    .eq("id", params.jobId)
    .eq("tenant_id", params.tenantId)
    .select()
    .single();

  if (!data) return null;

  // Log
  await logUsage(params.tenantId, params.jobId, "update_status", { status: params.status });

  // Fire webhook if terminal state
  if (params.status === "printed" || params.status === "failed") {
    fireWebhook(params.tenantId, data).catch(() => {});
  }

  return data;
}

/**
 * Get job by ID, always scoped to tenant to prevent cross-tenant data leakage.
 * tenantId is required — never optional — to enforce isolation.
 */
export async function getJob(jobId: string, tenantId: string): Promise<PrintJob | null> {
  const { data } = await supabaseAdmin
    .from("print_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .single();
  return data || null;
}

export interface PrinterDevice {
  id: string;
  restaurant_id: string;
  tenant_id?: string;
  name: string;
  device_type: string;
  status: string;
  last_seen_at?: string;
  created_at: string;
}

/**
 * Get devices for a restaurant/tenant.
 */
export async function getDevices(restaurantId: string): Promise<PrinterDevice[]> {
  const { data } = await supabaseAdmin
    .from("printer_devices")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });
  return (data || []) as PrinterDevice[];
}

// ── Tenant Management ──

async function getTenant(tenantId: string): Promise<TenantInfo | null> {
  const { data } = await supabaseAdmin
    .from("pb_tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  return data || null;
}

/**
 * Get monthly usage for a tenant.
 */
export async function getMonthlyUsage(tenantId: string): Promise<{ count: number; limit: number }> {
  const tenant = await getTenant(tenantId);
  return {
    count: tenant?.usage_count || 0,
    limit: tenant?.monthly_limit || 0,
  };
}

// ── Usage Logging ──

async function logUsage(tenantId: string, jobId: string | null, action: string, metadata?: Record<string, unknown>) {
  await supabaseAdmin.from("pb_usage_logs").insert({
    tenant_id: tenantId,
    job_id: jobId,
    action,
    metadata: metadata || {},
  });
}

// ── Webhook Delivery ──

async function fireWebhook(tenantId: string, job: PrintJob) {
  const tenant = await getTenant(tenantId);
  if (!tenant?.webhook_url) return;

  const event = job.status === "printed" ? "job.printed" : "job.failed";
  const payload = {
    event,
    job_id: job.id,
    status: job.status,
    device_id: job.device_id,
    order_id: job.order_id,
    error_message: job.error_message || null,
    timestamp: new Date().toISOString(),
  };

  // Store delivery record
  const { data: delivery } = await supabaseAdmin
    .from("pb_webhook_deliveries")
    .insert({
      tenant_id: tenantId,
      job_id: job.id,
      event,
      url: tenant.webhook_url,
      payload,
      attempt: 1,
      status: "pending",
    })
    .select()
    .single();

  // Compute HMAC signature so recipients can verify webhook authenticity.
  // Tenants verify: sha256=<hex> matches HMAC-SHA256 of raw body using their webhook_secret.
  const payloadStr = JSON.stringify(payload);
  const signature = tenant.webhook_secret
    ? "sha256=" + crypto.createHmac("sha256", tenant.webhook_secret).update(payloadStr).digest("hex")
    : "";

  // Attempt delivery
  try {
    const res = await fetch(tenant.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OrderFlow-Event": event,
        ...(signature ? { "X-PrintBridge-Signature": signature } : {}),
      },
      body: payloadStr,
      signal: AbortSignal.timeout(10000),
    });

    await supabaseAdmin
      .from("pb_webhook_deliveries")
      .update({ status_code: res.status, status: res.ok ? "delivered" : "pending", next_retry_at: res.ok ? null : retryTime(1) })
      .eq("id", delivery?.id);
  } catch {
    await supabaseAdmin
      .from("pb_webhook_deliveries")
      .update({ status: "pending", next_retry_at: retryTime(1) })
      .eq("id", delivery?.id);
  }
}

function retryTime(attempt: number): string {
  const delays = [5000, 30000, 300000]; // 5s, 30s, 5min
  const delay = delays[Math.min(attempt - 1, delays.length - 1)];
  return new Date(Date.now() + delay).toISOString();
}

/**
 * Retry pending webhook deliveries (called by cron).
 */
export async function retryPendingWebhooks() {
  const { data: pending } = await supabaseAdmin
    .from("pb_webhook_deliveries")
    .select("*")
    .eq("status", "pending")
    .lt("next_retry_at", new Date().toISOString())
    .lt("attempt", 4)
    .limit(50);

  for (const delivery of pending || []) {
    try {
      const bodyStr = JSON.stringify(delivery.payload);
      // Re-sign on retry using the tenant's current webhook_secret
      const tenant = await getTenant(delivery.tenant_id);
      const retrySig = tenant?.webhook_secret
        ? "sha256=" + crypto.createHmac("sha256", tenant.webhook_secret).update(bodyStr).digest("hex")
        : "";

      const res = await fetch(delivery.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OrderFlow-Event": delivery.event,
          ...(retrySig ? { "X-PrintBridge-Signature": retrySig } : {}),
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10000),
      });

      await supabaseAdmin
        .from("pb_webhook_deliveries")
        .update({
          attempt: delivery.attempt + 1,
          status_code: res.status,
          status: res.ok ? "delivered" : (delivery.attempt >= 3 ? "failed" : "pending"),
          next_retry_at: res.ok ? null : retryTime(delivery.attempt + 1),
        })
        .eq("id", delivery.id);
    } catch {
      await supabaseAdmin
        .from("pb_webhook_deliveries")
        .update({
          attempt: delivery.attempt + 1,
          status: delivery.attempt >= 3 ? "failed" : "pending",
          next_retry_at: retryTime(delivery.attempt + 1),
        })
        .eq("id", delivery.id);
    }
  }
}
