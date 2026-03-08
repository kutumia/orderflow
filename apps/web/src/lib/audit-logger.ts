/**
 * Audit Logger — Enterprise-Grade Audit Trail
 * E2-T06 — Critical audit logging for all sensitive operations.
 *
 * Every audit event captures:
 *   actor       — userId or "system" or "cron" or "api-key:<prefix>"
 *   tenant      — restaurantId or tenantId (namespace)
 *   action      — what happened (verb_noun, e.g. "refund.issued")
 *   target_type — entity type ("order", "user", "menu_item", etc.)
 *   target_id   — entity ID
 *   result      — "success" | "failure" | "denied"
 *   metadata    — additional context (no PII except what's necessary)
 *   ip          — client IP
 *   correlation_id — request correlation ID
 *   timestamp   — ISO8601 UTC
 *
 * Events are written to the `audit_logs` table in Supabase.
 * They are also emitted to the structured logger for log-drain ingestion.
 *
 * Usage:
 *   import { audit } from "@/lib/audit-logger";
 *   await audit(req, {
 *     actor: guard.user.id,
 *     tenant: guard.restaurantId,
 *     action: "refund.issued",
 *     target_type: "order",
 *     target_id: order_id,
 *     result: "success",
 *     metadata: { amount_pence: refund.amount, stripe_refund_id: refund.id },
 *   });
 */

import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/logger";
import { getCorrelationId } from "@/lib/correlation";
import { getClientIp } from "@/lib/rate-limit";

export type AuditResult = "success" | "failure" | "denied";

export interface AuditEvent {
  actor: string;               // userId, "system", "cron", "api-key:<prefix>"
  tenant: string;              // restaurantId or tenantId
  action: string;              // e.g. "refund.issued", "staff.created", "order.status_changed"
  target_type: string;         // "order", "user", "menu_item", "settings", "staff", etc.
  target_id: string;           // entity ID
  result: AuditResult;
  metadata?: Record<string, unknown>;  // no raw PII; sanitised values only
  error_message?: string;      // sanitised error message if result=failure
}

/**
 * Write an audit event. Non-throwing — failures are logged but do not break the operation.
 */
export async function audit(
  req: Request,
  event: AuditEvent
): Promise<void> {
  const correlationId = getCorrelationId(req);
  const ip = getClientIp(req);
  const timestamp = new Date().toISOString();

  // Emit to structured logger (goes to log drain / Datadog)
  log.info(`audit.${event.action}`, {
    audit: true,
    actor: event.actor,
    tenant: event.tenant,
    action: event.action,
    target_type: event.target_type,
    target_id: event.target_id,
    result: event.result,
    correlationId,
    ip,
    timestamp,
    ...(event.metadata ? { metadata: event.metadata } : {}),
    ...(event.error_message ? { error_message: event.error_message } : {}),
  });

  // Write to audit_logs table (persistent audit trail)
  try {
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        actor: event.actor,
        tenant_id: event.tenant,
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        result: event.result,
        metadata: event.metadata ?? {},
        error_message: event.error_message ?? null,
        ip_address: ip,
        correlation_id: correlationId,
        created_at: timestamp,
      });
  } catch (err: unknown) {
    // Audit log write failure must not break the operation — log and continue
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("audit_log write failed", {
      action: event.action,
      actor: event.actor,
      correlationId,
      error: message,
    });
  }
}

/**
 * Audit an operation for a system/machine actor (cron, internal service).
 */
export async function auditSystem(
  correlationId: string,
  event: Omit<AuditEvent, "actor"> & { actor?: string }
): Promise<void> {
  const timestamp = new Date().toISOString();
  const actor = event.actor ?? "system";

  log.info(`audit.${event.action}`, {
    audit: true,
    actor,
    tenant: event.tenant,
    action: event.action,
    target_type: event.target_type,
    target_id: event.target_id,
    result: event.result,
    correlationId,
    timestamp,
    ...(event.metadata ? { metadata: event.metadata } : {}),
  });

  try {
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        actor,
        tenant_id: event.tenant,
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        result: event.result,
        metadata: event.metadata ?? {},
        error_message: event.error_message ?? null,
        ip_address: "system",
        correlation_id: correlationId,
        created_at: timestamp,
      });
  } catch {
    // Non-fatal
  }
}

// ── Convenience action constants ─────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: "auth.login_success",
  LOGIN_FAILURE: "auth.login_failure",
  LOGOUT: "auth.logout",
  PASSWORD_RESET: "auth.password_reset",
  PASSWORD_CHANGED: "auth.password_changed",

  // Staff management
  STAFF_CREATED: "staff.created",
  STAFF_UPDATED: "staff.updated",
  STAFF_DELETED: "staff.deleted",

  // Orders
  ORDER_CREATED: "order.created",
  ORDER_STATUS_CHANGED: "order.status_changed",
  REFUND_ISSUED: "order.refund_issued",
  REFUND_FAILED: "order.refund_failed",

  // Settings
  SETTINGS_UPDATED: "settings.updated",
  HOURS_UPDATED: "hours.updated",

  // Webhooks
  WEBHOOK_RECEIVED: "webhook.received",
  WEBHOOK_PROCESSED: "webhook.processed",
  WEBHOOK_FAILED: "webhook.failed",
  WEBHOOK_HMAC_INVALID: "webhook.hmac_invalid",

  // Print
  PRINT_JOB_CREATED: "print.job_created",
  PRINT_JOB_FAILED: "print.job_failed",

  // Admin
  ADMIN_IMPERSONATION: "admin.impersonation",

  // GDPR
  GDPR_EXPORT: "gdpr.export",
  GDPR_DELETE: "gdpr.delete",

  // Cron
  CRON_RUN: "cron.run",
  CRON_COMPLETED: "cron.completed",
  CRON_FAILED: "cron.failed",

  // Integration
  SHOPIFY_CONNECTED: "integration.shopify_connected",
  SHOPIFY_DISCONNECTED: "integration.shopify_disconnected",
} as const;
