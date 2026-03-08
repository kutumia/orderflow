#!/usr/bin/env npx ts-node
/**
 * Operator Tool: inspect-tenant
 * Displays tenant (restaurant) configuration, integrations, and health status.
 *
 * Usage:
 *   npx ts-node scripts/inspect-tenant.ts --restaurant-id <id>
 *   npx ts-node scripts/inspect-tenant.ts --slug <restaurant_slug>
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
const restaurantIdArg = args.indexOf("--restaurant-id");
const slugArg = args.indexOf("--slug");

const restaurantId = restaurantIdArg !== -1 ? args[restaurantIdArg + 1] : null;
const slug = slugArg !== -1 ? args[slugArg + 1] : null;

if (!restaurantId && !slug) {
  console.error("Usage: inspect-tenant.ts (--restaurant-id <id> | --slug <slug>)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function maskSecret(value: string | null | undefined): string {
  if (!value) return "(not set)";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

async function main() {
  // Fetch restaurant
  const query = supabase.from("restaurants").select("*");
  const { data: restaurant, error } = restaurantId
    ? await query.eq("id", restaurantId).single()
    : await query.eq("slug", slug).single();

  if (error || !restaurant) {
    console.error("Restaurant not found:", error);
    process.exit(1);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("TENANT CONFIGURATION");
  console.log("═══════════════════════════════════════");
  console.log(`  ID:              ${restaurant.id}`);
  console.log(`  Name:            ${restaurant.name}`);
  console.log(`  Slug:            ${restaurant.slug}`);
  console.log(`  Active:          ${restaurant.is_active}`);
  console.log(`  Plan:            ${restaurant.plan ?? "standard"}`);
  console.log(`  Stripe Account:  ${maskSecret(restaurant.stripe_account_id)}`);
  console.log(`  Created At:      ${restaurant.created_at}`);

  // Staff count
  const { count: staffCount } = await supabase
    .from("staff")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id);
  console.log(`  Staff Members:   ${staffCount ?? 0}`);

  // Menu items count
  const { count: menuCount } = await supabase
    .from("menu_items")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id);
  console.log(`  Menu Items:      ${menuCount ?? 0}`);

  // Shopify integration
  const { data: shopifySettings } = await supabase
    .from("shopify_settings")
    .select("shop_domain, enabled, connected_at")
    .eq("restaurant_id", restaurant.id)
    .single();

  console.log("\n───────────────────────────────────────");
  console.log("SHOPIFY INTEGRATION");
  console.log("───────────────────────────────────────");
  if (shopifySettings) {
    console.log(`  Shop Domain:     ${shopifySettings.shop_domain}`);
    console.log(`  Enabled:         ${shopifySettings.enabled}`);
    console.log(`  Connected At:    ${shopifySettings.connected_at}`);
  } else {
    console.log("  (not connected)");
  }

  // PrintBridge
  const { data: pbTenant } = await supabase
    .from("pb_tenants")
    .select("id, enabled, created_at")
    .eq("restaurant_id", restaurant.id)
    .single();

  const { data: pbDevices } = await supabase
    .from("pb_devices")
    .select("id, name, last_seen_at, status")
    .eq("tenant_id", pbTenant?.id);

  console.log("\n───────────────────────────────────────");
  console.log("PRINTBRIDGE");
  console.log("───────────────────────────────────────");
  if (pbTenant) {
    console.log(`  Tenant ID:       ${pbTenant.id}`);
    console.log(`  Enabled:         ${pbTenant.enabled}`);
    console.log(`  Devices (${pbDevices?.length ?? 0}):`);
    for (const device of pbDevices ?? []) {
      const lastSeen = device.last_seen_at
        ? new Date(device.last_seen_at).toISOString()
        : "never";
      const ageMs = device.last_seen_at
        ? Date.now() - new Date(device.last_seen_at).getTime()
        : Infinity;
      const online = ageMs < 5 * 60 * 1000;
      console.log(`    [${device.id}] ${device.name} — ${online ? "ONLINE" : "OFFLINE"} (last: ${lastSeen})`);
    }
  } else {
    console.log("  (not configured)");
  }

  // Recent orders summary
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("status, count")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  console.log("\n───────────────────────────────────────");
  console.log("LAST 24H ORDER STATS");
  console.log("───────────────────────────────────────");
  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  console.log(`  Total Orders:    ${orderCount ?? 0}`);

  console.log("\n═══════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[inspect-tenant] Fatal error:", err);
  process.exit(1);
});
