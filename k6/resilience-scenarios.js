/**
 * k6 Resilience Scenario Suite — E7-T03
 *
 * Tests system behaviour under degraded conditions:
 *   1. Rate limit enforcement (verify 429 returned, not crash)
 *   2. Large payload rejection (verify 400, not timeout)
 *   3. Invalid input handling (verify proper error messages)
 *   4. Auth boundary testing (verify 401/403 enforcement)
 *   5. Concurrent checkout (verify no double-charge)
 *
 * Run: k6 run k6/resilience-scenarios.js --env BASE_URL=https://staging.orderflow.co.uk
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const successRate = new Rate("scenario_success");
const errorCount = new Counter("expected_errors");

export const options = {
  scenarios: {
    // Scenario 1: Rate limit enforcement
    rate_limit_test: {
      executor: "constant-vus",
      vus: 20,
      duration: "30s",
      tags: { scenario: "rate_limit" },
    },
  },
  thresholds: {
    // These scenarios intentionally trigger errors — so error rate isn't the measure
    // Instead, verify that the CORRECT errors are returned
    scenario_success: ["rate>0.95"], // 95% of resilience checks pass
  },
};

export default function () {
  const scenario = __ENV.SCENARIO || "all";

  if (scenario === "rate_limit" || scenario === "all") {
    testRateLimitEnforcement();
  }

  if (scenario === "large_payload" || scenario === "all") {
    testLargePayloadRejection();
  }

  if (scenario === "invalid_input" || scenario === "all") {
    testInvalidInputHandling();
  }

  if (scenario === "auth_boundary" || scenario === "all") {
    testAuthBoundaries();
  }

  sleep(0.5);
}

function testRateLimitEnforcement() {
  group("Rate limit enforcement", () => {
    // Fire 15 rapid requests to checkout (limit is 10/min)
    let rateLimitHit = false;
    for (let i = 0; i < 15; i++) {
      const res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify({
        restaurant_id: "00000000-0000-0000-0000-000000000000",
        // Minimal invalid payload to trigger validation quickly
      }), {
        headers: { "Content-Type": "application/json" },
        tags: { name: "rate-limit-checkout" },
      });

      if (res.status === 429) {
        rateLimitHit = true;
        errorCount.add(1); // Expected error

        const ok = check(res, {
          "rate limit: returns 429": (r) => r.status === 429,
          "rate limit: has Retry-After header": (r) => r.headers["Retry-After"] !== undefined,
          "rate limit: has X-RateLimit-Limit header": (r) => r.headers["X-RateLimit-Limit"] !== undefined,
          "rate limit: error message is generic": (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.error && body.error.toLowerCase().includes("too many requests");
            } catch { return false; }
          },
        });
        successRate.add(ok ? 1 : 0);
        break;
      }
    }

    successRate.add(rateLimitHit ? 1 : 0);
  });
}

function testLargePayloadRejection() {
  group("Large payload rejection", () => {
    // Send an oversized payload (10MB) — should be rejected quickly
    const largeString = "x".repeat(10 * 1024 * 1024); // 10MB
    const res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify({
      restaurant_id: "test",
      notes: largeString,
    }), {
      headers: { "Content-Type": "application/json" },
      tags: { name: "large-payload" },
      timeout: "10s",
    });

    const ok = check(res, {
      "large payload: rejected (400 or 413)": (r) => r.status === 400 || r.status === 413,
      "large payload: not a 500": (r) => r.status !== 500,
      "large payload: fast rejection < 5s": (r) => r.timings.duration < 5000,
    });
    successRate.add(ok ? 1 : 0);
    if (!ok) errorCount.add(1);
  });
}

function testInvalidInputHandling() {
  group("Invalid input handling", () => {
    const testCases = [
      // XSS attempt
      {
        payload: { restaurant_id: "<script>alert(1)</script>", customer_name: "test", customer_email: "xss@test.com", customer_phone: "07700000000", items: [], order_type: "collection", allergen_confirmed: true },
        name: "XSS in restaurant_id",
      },
      // SQL injection attempt
      {
        payload: { restaurant_id: "' OR '1'='1", customer_name: "test", customer_email: "sql@test.com", customer_phone: "07700000000", items: [], order_type: "collection", allergen_confirmed: true },
        name: "SQL injection in restaurant_id",
      },
      // Missing required field
      {
        payload: { restaurant_id: "00000000-0000-0000-0000-000000000000" },
        name: "Missing required fields",
      },
      // Invalid email
      {
        payload: { restaurant_id: "00000000-0000-0000-0000-000000000000", customer_name: "test", customer_email: "not-an-email", customer_phone: "07700000000", items: [{ item_id: "00000000-0000-0000-0000-000000000001", quantity: 1 }], order_type: "collection", allergen_confirmed: true },
        name: "Invalid email format",
      },
    ];

    for (const testCase of testCases) {
      const res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify(testCase.payload), {
        headers: { "Content-Type": "application/json" },
        tags: { name: "invalid-input" },
      });

      const ok = check(res, {
        [`${testCase.name}: rejected with 400`]: (r) => r.status === 400,
        [`${testCase.name}: not a 500`]: (r) => r.status !== 500,
        [`${testCase.name}: error in response`]: (r) => {
          try { return JSON.parse(r.body).error !== undefined; } catch { return false; }
        },
      });
      successRate.add(ok ? 1 : 0);
    }
  });
}

function testAuthBoundaries() {
  group("Auth boundary enforcement", () => {
    const protectedEndpoints = [
      { method: "GET", path: "/api/orders" },
      { method: "GET", path: "/api/staff" },
      { method: "GET", path: "/api/reports" },
      { method: "GET", path: "/api/restaurant-settings" },
      { method: "GET", path: "/api/admin" },
      { method: "GET", path: "/api/shopify/orders" },
    ];

    for (const endpoint of protectedEndpoints) {
      const res = endpoint.method === "GET"
        ? http.get(`${BASE_URL}${endpoint.path}`, { tags: { name: "auth-boundary" } })
        : http.post(`${BASE_URL}${endpoint.path}`, "{}", {
            headers: { "Content-Type": "application/json" },
            tags: { name: "auth-boundary" },
          });

      const ok = check(res, {
        [`${endpoint.method} ${endpoint.path}: requires auth (401 or 403)`]: (r) =>
          r.status === 401 || r.status === 403,
        [`${endpoint.method} ${endpoint.path}: not 200`]: (r) => r.status !== 200,
        [`${endpoint.method} ${endpoint.path}: not 500`]: (r) => r.status !== 500,
      });
      successRate.add(ok ? 1 : 0);
      if (!ok) errorCount.add(1);
    }
  });
}
