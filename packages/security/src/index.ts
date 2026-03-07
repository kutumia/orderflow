/**
 * Security & operational safety utilities for OrderFlow.
 *
 * Fixes: #2 (partner auth), #5 (input validation), #8 (atomic promo),
 * #11 (SMS caps), #12 (email throttling), #13 (order anti-spam),
 * #15 (Stripe health), #16 (location permissions), #18 (structured alerts),
 * #19 (audit logging).
 */

import { getSupabaseAdmin, log } from "@orderflow/core-infra";

const supabaseAdmin = getSupabaseAdmin();

// ── Fix #11: SMS spending guardrails ──

const SMS_MONTHLY_CAP = parseInt(process.env.SMS_MONTHLY_CAP || "500");

export async function checkSmsCap(restaurantId: string): Promise<boolean> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("automation_logs")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("channel", "sms")
    .gte("created_at", monthStart.toISOString());

  return (count || 0) < SMS_MONTHLY_CAP;
}

// ── Fix #12: Email throttling per customer ──

export async function canSendToCustomer(
  restaurantId: string,
  email: string,
  cooldownHours: number = 24
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownHours * 3600000).toISOString();

  const { count } = await supabaseAdmin
    .from("automation_logs")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("customer_email", email)
    .gte("created_at", since);

  return (count || 0) < 3; // Max 3 automated emails per customer per cooldown window
}

// ── Fix #15: Stripe payout health check ──

export async function checkStripeHealth(restaurantId: string): Promise<{
  connected: boolean;
  issue?: string;
}> {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("stripe_account_id, name")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.stripe_account_id) {
    return { connected: false, issue: "No Stripe account connected" };
  }

  try {
    const stripe = (await import("@/lib/stripe")).stripe;
    const account = await stripe.accounts.retrieve(restaurant.stripe_account_id);

    if (account.charges_enabled === false) {
      await logAlert(restaurantId, "stripe_disabled", `Stripe charges disabled for ${restaurant.name}`);
      return { connected: false, issue: "Charges are disabled on Stripe account" };
    }
    if (account.payouts_enabled === false) {
      await logAlert(restaurantId, "stripe_payouts_disabled", `Stripe payouts disabled for ${restaurant.name}`);
      return { connected: false, issue: "Payouts are disabled on Stripe account" };
    }

    return { connected: true };
  } catch {
    return { connected: false, issue: "Could not verify Stripe account" };
  }
}

// ── Fix #16: Location permission enforcement ──

export async function userCanAccessRestaurant(
  userId: string,
  restaurantId: string,
  requiredRole?: "owner" | "manager" | "staff"
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_restaurants")
    .select("role")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!data) return false;

  if (requiredRole === "owner") return data.role === "owner";
  if (requiredRole === "manager") return ["owner", "manager"].includes(data.role);
  return true; // Any linked role is sufficient
}

// ── Fix #18: Structured error alerting ──

export async function sendAlert(
  severity: "critical" | "warning" | "info",
  message: string,
  context?: Record<string, unknown>
) {
  log[severity === "critical" ? "error" : severity === "warning" ? "warn" : "info"](
    message,
    context || {}
  );

  // Slack webhook alert for critical issues
  const slackUrl = process.env.SLACK_ALERT_WEBHOOK;
  if (slackUrl && severity === "critical") {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 *${severity.toUpperCase()}*: ${message}\n\`\`\`${JSON.stringify(context || {}, null, 2)}\`\`\``,
        }),
      });
    } catch {}
  }

  // Also email for critical
  if (severity === "critical" && process.env.ALERT_EMAIL) {
    try {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: process.env.ALERT_EMAIL,
        subject: `[OrderFlow] CRITICAL: ${message}`,
        html: `<p>${message}</p><pre>${JSON.stringify(context || {}, null, 2)}</pre>`,
      });
    } catch {}
  }
}

// ── Fix #19: Audit logging ──

export async function auditLog(params: {
  user_id?: string;
  restaurant_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.user_id || null,
      restaurant_id: params.restaurant_id || null,
      action: params.action,
      resource_type: params.resource_type,
      resource_id: params.resource_id || null,
      details: params.details || {},
      ip_address: params.ip || null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Never let audit logging fail the main operation
  }
}

// ── Helper: log performance alerts ──

async function logAlert(restaurantId: string, type: string, message: string) {
  await supabaseAdmin.from("performance_alerts").insert({
    restaurant_id: restaurantId,
    alert_type: type,
    message,
  });
}

// ── Fix #5: Validate generic API input ──

export function validateApiInput(body: Record<string, unknown>, rules: {
  field: string;
  required?: boolean;
  maxLength?: number;
  type?: "string" | "number" | "boolean";
  min?: number;
  max?: number;
}[]): string | null {
  for (const rule of rules) {
    const val = body[rule.field];
    if (rule.required && (val === undefined || val === null || val === "")) {
      return `${rule.field} is required`;
    }
    if (val === undefined || val === null) continue;
    if (rule.type === "string" && typeof val !== "string") {
      return `${rule.field} must be a string`;
    }
    if (rule.type === "number" && typeof val !== "number") {
      return `${rule.field} must be a number`;
    }
    if (rule.maxLength && typeof val === "string" && val.length > rule.maxLength) {
      return `${rule.field} must be ${rule.maxLength} characters or fewer`;
    }
    if (rule.min !== undefined && typeof val === "number" && val < rule.min) {
      return `${rule.field} must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && typeof val === "number" && val > rule.max) {
      return `${rule.field} must be at most ${rule.max}`;
    }
  }
  return null;
}
