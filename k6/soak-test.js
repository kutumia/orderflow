/**
 * k6 Soak Test for OrderFlow — E7-T04
 *
 * Run: k6 run k6/soak-test.js --env BASE_URL=https://staging.orderflow.co.uk
 *
 * Soak test verifies system stability under sustained load (not peak load).
 * Catches memory leaks, connection pool exhaustion, DB cursor leaks.
 *
 * Duration: 2 hours at 50% of peak load
 * Targets: p95 < 800ms, error rate < 0.5%, no degradation over time
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_SLUG = __ENV.TEST_SLUG || "test-restaurant";
const TEST_RESTAURANT_ID = __ENV.TEST_RESTAURANT_ID || "";

const errorRate = new Rate("errors");
const menuLatency = new Trend("menu_latency");
const checkoutLatency = new Trend("checkout_latency");
const healthLatency = new Trend("health_latency");
const requestCount = new Counter("total_requests");

export const options = {
  scenarios: {
    // Sustained menu browsing (50% of peak load)
    sustained_menu: {
      executor: "constant-vus",
      vus: 50,
      duration: "2h",
      tags: { scenario: "sustained_menu" },
    },
    // Sustained checkout attempts
    sustained_checkout: {
      executor: "constant-arrival-rate",
      rate: 5,          // 5 checkouts per minute (50% of peak 10)
      timeUnit: "1m",
      duration: "2h",
      preAllocatedVUs: 10,
      maxVUs: 20,
      tags: { scenario: "sustained_checkout" },
    },
    // Health check monitoring (should always be fast)
    health_monitoring: {
      executor: "constant-arrival-rate",
      rate: 1,          // 1 health check per 30s
      timeUnit: "30s",
      duration: "2h",
      preAllocatedVUs: 2,
      tags: { scenario: "health_monitoring" },
    },
  },
  thresholds: {
    // Latency must not degrade over the soak period
    menu_latency: ["p95<800", "p99<1500"],
    checkout_latency: ["p95<2000", "p99<5000"],
    health_latency: ["p95<300", "p99<500"],
    // Error rate must stay very low
    errors: ["rate<0.005"],   // < 0.5%
    // All HTTP checks must pass
    http_req_failed: ["rate<0.005"],
    http_req_duration: ["p95<800"],
  },
};

export function setup() {
  // Verify target is accessible before 2-hour soak
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Health check failed before soak: ${res.status} - ${res.body}`);
  }
  console.log(`Soak test starting against: ${BASE_URL}`);
  console.log(`Health: ${JSON.parse(res.body).status}`);
  return { baseUrl: BASE_URL };
}

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || "sustained_menu";

  if (scenario === "sustained_menu") {
    menuScenario();
  } else if (scenario === "sustained_checkout") {
    checkoutScenario();
  } else if (scenario === "health_monitoring") {
    healthScenario();
  } else {
    menuScenario();
  }
}

function menuScenario() {
  group("menu browsing", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/menu-items?restaurant_id=${TEST_RESTAURANT_ID || "test"}`, {
      tags: { name: "menu-items" },
    });
    menuLatency.add(Date.now() - start);
    requestCount.add(1);

    const ok = check(res, {
      "menu: status is 200 or 400": (r) => r.status === 200 || r.status === 400,
      "menu: response time < 1s": (r) => r.timings.duration < 1000,
      "menu: body is JSON": (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
    if (!ok) errorRate.add(1);
    else errorRate.add(0);

    sleep(Math.random() * 3 + 1); // 1-4s between requests
  });

  // Occasionally check categories too
  if (Math.random() < 0.3) {
    const res = http.get(`${BASE_URL}/api/categories?restaurant_id=${TEST_RESTAURANT_ID || "test"}`, {
      tags: { name: "categories" },
    });
    check(res, { "categories: status 200 or 400": (r) => r.status === 200 || r.status === 400 });
  }
}

function checkoutScenario() {
  group("checkout attempt", () => {
    const payload = JSON.stringify({
      restaurant_id: TEST_RESTAURANT_ID || "00000000-0000-0000-0000-000000000000",
      customer_name: "Soak Test User",
      customer_email: "soak@test.invalid",
      customer_phone: "07700000000",
      items: [{ item_id: "00000000-0000-0000-0000-000000000001", quantity: 1 }],
      order_type: "collection",
      allergen_confirmed: true,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/checkout`, payload, {
      headers: { "Content-Type": "application/json" },
      tags: { name: "checkout" },
    });
    checkoutLatency.add(Date.now() - start);
    requestCount.add(1);

    // In soak test, checkout will fail (test restaurant ID) — that's expected
    // We're testing the API layer stability, not the business logic
    const ok = check(res, {
      "checkout: response received (any status)": (r) => r.status > 0,
      "checkout: not server crash (not 500)": (r) => r.status !== 500,
      "checkout: response time < 5s": (r) => r.timings.duration < 5000,
    });
    if (!ok) errorRate.add(1);
    else errorRate.add(0);
  });
}

function healthScenario() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "health" },
  });
  healthLatency.add(Date.now() - start);
  requestCount.add(1);

  const ok = check(res, {
    "health: status 200": (r) => r.status === 200,
    "health: status is healthy": (r) => {
      try { return JSON.parse(r.body).status === "healthy"; } catch { return false; }
    },
    "health: response time < 500ms": (r) => r.timings.duration < 500,
  });
  if (!ok) errorRate.add(1);
  else errorRate.add(0);
}

export function teardown() {
  console.log("Soak test complete. Check latency trends for degradation over time.");
}
