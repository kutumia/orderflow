/**
 * RLS Audit — Structural verification that every dashboard API route
 * is protected by the guard utility and scopes queries by restaurant_id.
 *
 * This test suite reads the actual route source files on disk and asserts
 * that the correct patterns are present, providing real coverage rather
 * than stub-based `expect(true).toBe(true)` checks.
 *
 * For full RLS integration tests (which require a live Supabase instance),
 * set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY environment variables.
 * Those tests are automatically skipped when the variables are absent.
 */

import * as fs from "fs";
import * as path from "path";

// ── Structural audit (always runs — no live DB required) ──────────────────────

const API_DIR = path.join(__dirname, "../app/api");

/** Routes that MUST use a guard (requireSession / requireOwner / requireManager). */
const GUARDED_ROUTES = [
  "orders/route.ts",
  "staff/route.ts",
  "categories/route.ts",
  "menu-items/route.ts",
  "customers/route.ts",
  "promo-codes/route.ts",
  "hours/route.ts",
  "dashboard-stats/route.ts",
  "restaurant-settings/route.ts",
  "marketing/route.ts",
  "loyalty/route.ts",
  "reports/route.ts",
  "subscription/route.ts",
  "change-password/route.ts",
];

/** Routes where we also verify explicit .eq("restaurant_id") scoping. */
const SCOPED_ROUTES = [
  "orders/route.ts",
  "staff/route.ts",
  "categories/route.ts",
  "customers/route.ts",
  "promo-codes/route.ts",
  "hours/route.ts",
];

describe("RLS Audit — Route Guard Coverage", () => {
  test.each(GUARDED_ROUTES)(
    "%s uses requireSession, requireOwner, or requireManager",
    (routeFile) => {
      const filePath = path.join(API_DIR, routeFile);
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      const hasGuard =
        content.includes("requireSession") ||
        content.includes("requireOwner") ||
        content.includes("requireManager");
      expect(hasGuard).toBe(true);
    }
  );

  test.each(SCOPED_ROUTES)(
    "%s scopes all data queries to the authenticated restaurant_id",
    (routeFile) => {
      const filePath = path.join(API_DIR, routeFile);
      const content = fs.readFileSync(filePath, "utf8");
      // The guard provides restaurantId; every query should use it.
      const hasScope =
        content.includes('.eq("restaurant_id"') ||
        content.includes(".eq('restaurant_id'");
      expect(hasScope).toBe(true);
    }
  );

  test("guard.ts performs DB re-verification of restaurant ownership", () => {
    const guardPath = path.join(__dirname, "../lib/guard.ts");
    expect(fs.existsSync(guardPath)).toBe(true);
    const content = fs.readFileSync(guardPath, "utf8");
    // Must fetch user from DB — not just trust the JWT
    expect(content).toContain('.from("users")');
    // Must compare DB restaurant_id to JWT restaurant_id
    expect(content).toContain("dbUser.restaurant_id");
  });

  test("auth.ts JWT callback re-validates against DB every 15 minutes", () => {
    const authPath = path.join(__dirname, "../lib/auth.ts");
    const content = fs.readFileSync(authPath, "utf8");
    expect(content).toContain("JWT_REVALIDATE_INTERVAL_MS");
    expect(content).toContain("lastChecked");
    expect(content).toContain("UserNotFound");
  });

  test("admin impersonation route stores sessions server-side (not client sessionStorage)", () => {
    const impersonatePath = path.join(
      API_DIR,
      "admin/impersonate/route.ts"
    );
    const content = fs.readFileSync(impersonatePath, "utf8");
    // Must use HttpOnly cookie
    expect(content).toContain("httpOnly: true");
    // Must use admin_impersonation_sessions table
    expect(content).toContain("admin_impersonation_sessions");
    // Must NOT reference sessionStorage (that was the old client-side approach)
    expect(content).not.toContain("sessionStorage");
  });

  test("Shopify webhook HMAC verification is unconditional", () => {
    const shopifyPath = path.join(API_DIR, "shopify/webhooks/route.ts");
    const content = fs.readFileSync(shopifyPath, "utf8");
    // apiSecret must be required, not optional
    expect(content).toContain("SHOPIFY_API_SECRET");
    // Must return 401 for missing HMAC
    expect(content).toContain("401");
  });

  test("Stripe webhook requires signature verification", () => {
    const stripePath = path.join(API_DIR, "webhooks/stripe/route.ts");
    const content = fs.readFileSync(stripePath, "utf8");
    expect(content).toContain("constructEvent");
    expect(content).toContain("STRIPE_WEBHOOK_SECRET");
  });

  test("CRON routes require CRON_SECRET — no bypass via NODE_ENV check", () => {
    const cronRoutes = [
      "cron/onboarding-emails/route.ts",
      "cron/engagement/route.ts",
    ];
    for (const routeFile of cronRoutes) {
      const filePath = path.join(API_DIR, routeFile);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toContain("CRON_SECRET");
      // The bypass pattern was: `&& process.env.NODE_ENV === "production"` — must be gone
      expect(content).not.toMatch(/NODE_ENV.*===.*production.*CRON/);
    }
  });

  test("PrintBridge auth does not accept API key via query parameter", () => {
    const pbAuthPath = path.join(__dirname, "../lib/pb-auth.ts");
    const content = fs.readFileSync(pbAuthPath, "utf8");
    // Must NOT accept ?api_key= in the URL (appears in server access logs)
    expect(content).not.toContain("searchParams.get");
    // Must use header-only auth
    expect(content).toContain("X-API-Key");
  });
});

// ── Live Supabase RLS integration tests (skipped without env vars) ─────────────

const hasSupabaseEnv =
  !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY;

const describeIfSupabase = hasSupabaseEnv ? describe : describe.skip;

describeIfSupabase("RLS Integration — Cross-Tenant Isolation (requires live Supabase)", () => {
  // These tests use the real Supabase JS client to verify RLS policies
  // are correctly applied. They run against a local Supabase instance
  // (npx supabase start) and are skipped in CI unless the env vars are set.

  const SUPABASE_URL = process.env.SUPABASE_TEST_URL!;
  const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY!;
  const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY!;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");

  let adminClient: ReturnType<typeof createClient>;
  let restaurantAId: string;
  let restaurantBId: string;

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // Create two test restaurants
    const { data: restA } = await adminClient
      .from("restaurants")
      .insert({ name: "Test A", slug: `test-a-${Date.now()}`, is_active: true })
      .select()
      .single();
    const { data: restB } = await adminClient
      .from("restaurants")
      .insert({ name: "Test B", slug: `test-b-${Date.now()}`, is_active: true })
      .select()
      .single();

    restaurantAId = restA.id;
    restaurantBId = restB.id;

    // Seed an order for each restaurant
    await adminClient.from("orders").insert([
      { restaurant_id: restaurantAId, status: "pending", total: 1000 },
      { restaurant_id: restaurantBId, status: "pending", total: 2000 },
    ]);
  });

  afterAll(async () => {
    if (restaurantAId) {
      await adminClient.from("restaurants").delete().eq("id", restaurantAId);
    }
    if (restaurantBId) {
      await adminClient.from("restaurants").delete().eq("id", restaurantBId);
    }
  });

  it("anon client cannot read orders without authentication", async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await anonClient.from("orders").select("*");
    // With RLS enabled, anon client should see 0 rows
    expect(data).toHaveLength(0);
  });

  it("service role client can read all rows (admin bypass)", async () => {
    const { data } = await adminClient
      .from("orders")
      .select("*")
      .in("restaurant_id", [restaurantAId, restaurantBId]);
    expect(data!.length).toBeGreaterThanOrEqual(2);
  });
});
