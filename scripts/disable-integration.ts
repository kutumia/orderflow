#!/usr/bin/env npx ts-node
/**
 * Operator Tool: disable-integration
 * Disables a third-party integration (Shopify, PrintBridge) for a tenant.
 * Used during security incidents or when a tenant requests immediate disconnection.
 *
 * Usage:
 *   npx ts-node scripts/disable-integration.ts --restaurant-id <id> --integration shopify [--dry-run]
 *   npx ts-node scripts/disable-integration.ts --restaurant-id <id> --integration printbridge [--dry-run]
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
const dryRun = args.includes("--dry-run");

const restaurantIdArg = args.indexOf("--restaurant-id");
const integrationArg = args.indexOf("--integration");

const restaurantId = restaurantIdArg !== -1 ? args[restaurantIdArg + 1] : null;
const integration = integrationArg !== -1 ? args[integrationArg + 1] : null;

if (!restaurantId || !integration) {
  console.error("Usage: disable-integration.ts --restaurant-id <id> --integration <shopify|printbridge> [--dry-run]");
  process.exit(1);
}

if (!["shopify", "printbridge"].includes(integration)) {
  console.error("Error: integration must be one of: shopify, printbridge");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function disableShopify(restaurantId: string, dryRun: boolean) {
  const { data, error } = await supabase
    .from("shopify_settings")
    .select("id, shop_domain, enabled")
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !data) {
    console.log("[disable-integration] Shopify integration not found for this restaurant");
    return;
  }

  console.log(`[disable-integration] Shopify settings found:`);
  console.log(`  Shop Domain: ${data.shop_domain}`);
  console.log(`  Currently enabled: ${data.enabled}`);

  if (dryRun) {
    console.log("[disable-integration] DRY RUN — would set enabled=false and revoke tokens");
    return;
  }

  const { error: updateError } = await supabase
    .from("shopify_settings")
    .update({
      enabled: false,
      access_token: null,
      disabled_at: new Date().toISOString(),
      disabled_reason: "Operator: disable-integration script",
    })
    .eq("restaurant_id", restaurantId);

  if (updateError) {
    console.error("[disable-integration] Failed to disable Shopify:", updateError);
    process.exit(1);
  }

  console.log("[disable-integration] ✅ Shopify integration disabled");
  console.log("[disable-integration] Note: Revoke the OAuth token in Shopify Partners dashboard to fully disconnect");
}

async function disablePrintBridge(restaurantId: string, dryRun: boolean) {
  const { data: pbTenant, error } = await supabase
    .from("pb_tenants")
    .select("id, enabled")
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !pbTenant) {
    console.log("[disable-integration] PrintBridge tenant not found for this restaurant");
    return;
  }

  console.log(`[disable-integration] PrintBridge tenant found: ${pbTenant.id}`);
  console.log(`  Currently enabled: ${pbTenant.enabled}`);

  const { data: apiKeys } = await supabase
    .from("pb_api_keys")
    .select("id, key_prefix, created_at")
    .eq("tenant_id", pbTenant.id);

  console.log(`  Active API keys: ${apiKeys?.length ?? 0}`);

  if (dryRun) {
    console.log("[disable-integration] DRY RUN — would disable tenant and revoke all API keys");
    return;
  }

  // Disable tenant
  const { error: updateError } = await supabase
    .from("pb_tenants")
    .update({ enabled: false })
    .eq("id", pbTenant.id);

  if (updateError) {
    console.error("[disable-integration] Failed to disable PrintBridge tenant:", updateError);
    process.exit(1);
  }

  // Revoke all API keys
  const { error: keysError } = await supabase
    .from("pb_api_keys")
    .delete()
    .eq("tenant_id", pbTenant.id);

  if (keysError) {
    console.warn("[disable-integration] Warning: failed to revoke API keys:", keysError);
  } else {
    console.log(`[disable-integration] Revoked ${apiKeys?.length ?? 0} API key(s)`);
  }

  console.log("[disable-integration] ✅ PrintBridge integration disabled");
  console.log("[disable-integration] Note: Running agents will fail auth on next API call");
}

async function main() {
  console.log(`[disable-integration] Disabling ${integration} for restaurant: ${restaurantId}`);

  if (integration === "shopify") {
    await disableShopify(restaurantId!, dryRun);
  } else if (integration === "printbridge") {
    await disablePrintBridge(restaurantId!, dryRun);
  }
}

main().catch((err) => {
  console.error("[disable-integration] Fatal error:", err);
  process.exit(1);
});
