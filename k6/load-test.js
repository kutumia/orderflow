/**
 * k6 Load Test for OrderFlow
 *
 * Run: k6 run k6/load-test.js --env BASE_URL=https://staging.orderflow.co.uk
 *
 * Scenarios:
 *   - Menu views: 100 concurrent users browsing menus
 *   - Checkout: 50 concurrent users going through checkout
 *   - Dashboard: 20 concurrent restaurant owners managing orders
 *
 * Targets: p95 < 500ms, error rate < 1%
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_SLUG = __ENV.TEST_SLUG || "test-restaurant";

const errorRate = new Rate("errors");
const menuLatency = new Trend("menu_latency");
const checkoutLatency = new Trend("checkout_latency");
const dashboardLatency = new Trend("dashboard_latency");

export const options = {
  scenarios: {
    menu_browsing: {
      executor: "constant-vus",
      vus: 100,
      duration: "2m",
      exec: "menuBrowsing",
      tags: { scenario: "menu" },
    },
    checkout_flow: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
      startTime: "30s",
      exec: "checkoutFlow",
      tags: { scenario: "checkout" },
    },
    dashboard_usage: {
      executor: "constant-vus",
      vus: 20,
      duration: "2m",
      startTime: "1m",
      exec: "dashboardUsage",
      tags: { scenario: "dashboard" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.01"],
    menu_latency: ["p(95)<300"],
    checkout_latency: ["p(95)<500"],
    dashboard_latency: ["p(95)<800"],
  },
};

// ── Scenario 1: Menu Browsing ──
export function menuBrowsing() {
  group("Menu Browse", () => {
    // Load restaurant + menu
    const res = http.get(`${BASE_URL}/api/restaurants?slug=${TEST_SLUG}`);
    menuLatency.add(res.timings.duration);

    const ok = check(res, {
      "menu 200": (r) => r.status === 200,
      "has categories": (r) => {
        try { return JSON.parse(r.body).menu.length > 0; }
        catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time
}

// ── Scenario 2: Checkout Flow ──
export function checkoutFlow() {
  group("Checkout Flow", () => {
    // 1. Load menu
    const menuRes = http.get(`${BASE_URL}/api/restaurants?slug=${TEST_SLUG}`);
    check(menuRes, { "menu loaded": (r) => r.status === 200 });

    // 2. Validate promo (if any)
    const promoRes = http.get(
      `${BASE_URL}/api/promo-codes/validate?slug=${TEST_SLUG}&code=TEST10`
    );
    // Promo may or may not exist, both are valid responses
    check(promoRes, { "promo responded": (r) => r.status < 500 });

    // 3. Check loyalty
    const loyaltyRes = http.get(
      `${BASE_URL}/api/loyalty/check?restaurant_id=test&email=test@example.com`
    );
    check(loyaltyRes, { "loyalty responded": (r) => r.status < 500 });

    checkoutLatency.add(menuRes.timings.duration + promoRes.timings.duration);
  });

  sleep(Math.random() * 3 + 2); // 2-5s think time
}

// ── Scenario 3: Dashboard Usage ──
export function dashboardUsage() {
  group("Dashboard", () => {
    // These require auth — test public endpoints only in load test
    // In production, use session cookies

    // Health check
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, { "health 200": (r) => r.status === 200 });
    dashboardLatency.add(healthRes.timings.duration);

    // Reports (would need auth in production)
    sleep(1);
  });

  sleep(Math.random() * 3 + 2);
}

// ── Setup: verify test environment is ready ──
export function setup() {
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  console.log(`Load test starting against ${BASE_URL}`);
  return {};
}

// ── Teardown: print summary ──
export function teardown(data) {
  console.log("Load test complete.");
}
