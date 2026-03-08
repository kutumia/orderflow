#!/usr/bin/env npx ts-node
/**
 * Operator Tool: inspect-order
 * Displays full order details including payment state, print jobs, and audit log.
 *
 * Usage:
 *   npx ts-node scripts/inspect-order.ts --order-id <order_id>
 *   npx ts-node scripts/inspect-order.ts --order-number <order_number> --restaurant-id <id>
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const args = process.argv.slice(2);
const orderIdArg = args.indexOf("--order-id");
const orderNumberArg = args.indexOf("--order-number");
const restaurantIdArg = args.indexOf("--restaurant-id");

const orderId = orderIdArg !== -1 ? args[orderIdArg + 1] : null;
const orderNumber = orderNumberArg !== -1 ? args[orderNumberArg + 1] : null;
const restaurantId = restaurantIdArg !== -1 ? args[restaurantIdArg + 1] : null;

if (!orderId && !(orderNumber && restaurantId)) {
  console.error("Usage: inspect-order.ts (--order-id <id> | --order-number <num> --restaurant-id <id>)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function mask(value: string | null | undefined, keepChars = 4): string {
  if (!value) return "(none)";
  if (value.length <= keepChars) return "***";
  return value.slice(0, keepChars) + "***" + value.slice(-2);
}

async function main() {
  let order: Record<string, unknown> | null = null;

  if (orderId) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (error || !data) { console.error("Order not found:", error); process.exit(1); }
    order = data;
  } else {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", orderNumber)
      .eq("restaurant_id", restaurantId)
      .single();
    if (error || !data) { console.error("Order not found:", error); process.exit(1); }
    order = data;
  }

  console.log("\n═══════════════════════════════════════");
  console.log("ORDER DETAILS");
  console.log("═══════════════════════════════════════");
  console.log(`  ID:              ${order.id}`);
  console.log(`  Order Number:    ${order.order_number}`);
  console.log(`  Restaurant ID:   ${order.restaurant_id}`);
  console.log(`  Status:          ${order.status}`);
  console.log(`  Total (pence):   ${order.total_pence}`);
  console.log(`  Created At:      ${order.created_at}`);
  console.log(`  Updated At:      ${order.updated_at}`);
  console.log(`  PaymentIntent:   ${mask(order.stripe_payment_intent_id as string, 8)}`);
  console.log(`  Customer Email:  ${mask(order.customer_email as string, 3)}`);
  console.log(`  Items Count:     ${Array.isArray(order.items) ? order.items.length : 0}`);

  // Print jobs
  const { data: printJobs } = await supabase
    .from("pb_jobs")
    .select("id, status, attempts, error_message, created_at, updated_at")
    .eq("order_id", order.id as string)
    .order("created_at");

  console.log("\n───────────────────────────────────────");
  console.log(`PRINT JOBS (${printJobs?.length ?? 0})`);
  console.log("───────────────────────────────────────");
  if (!printJobs || printJobs.length === 0) {
    console.log("  (none)");
  } else {
    for (const job of printJobs) {
      console.log(`  [${job.id}] status=${job.status} attempts=${job.attempts} created=${job.created_at}`);
      if (job.error_message) console.log(`    error: ${job.error_message}`);
    }
  }

  // Audit log
  const { data: auditEvents } = await supabase
    .from("audit_logs")
    .select("action, actor, result, created_at, metadata")
    .eq("target_id", order.id as string)
    .order("created_at");

  console.log("\n───────────────────────────────────────");
  console.log(`AUDIT TRAIL (${auditEvents?.length ?? 0} events)`);
  console.log("───────────────────────────────────────");
  if (!auditEvents || auditEvents.length === 0) {
    console.log("  (none)");
  } else {
    for (const evt of auditEvents) {
      console.log(`  [${evt.created_at}] ${evt.action} | actor=${evt.actor} | result=${evt.result}`);
    }
  }

  console.log("\n═══════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[inspect-order] Fatal error:", err);
  process.exit(1);
});
