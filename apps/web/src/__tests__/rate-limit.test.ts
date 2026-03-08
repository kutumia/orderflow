/**
 * Rate Limiter Tests — checkRateLimit / checkRateLimitAsync / getClientIp
 *
 * Tests the in-memory fallback path (Upstash not configured in test env).
 * Verifies that:
 *   1. First request within window is allowed (returns null)
 *   2. Request exceeding limit returns 429 with correct headers
 *   3. IP extraction reads x-forwarded-for correctly
 *   4. Different IPs get independent counters
 *   5. New buckets (refund, mutation) are correctly capped
 */

import { checkRateLimit, checkRateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Build a minimal Request-like object for tests
function makeReq(ip: string, path = "/api/test"): Request {
  return new Request(`http://localhost${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

// ── getClientIp ──────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP header is present", () => {
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBe("unknown");
  });
});

// ── checkRateLimit (sync, in-memory) ────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows the first request (returns null)", () => {
    const result = checkRateLimit(makeReq("10.0.0.1", "/api/rl-test-1"), 3, 60_000);
    expect(result).toBeNull();
  });

  it("allows requests up to the limit", () => {
    const path = "/api/rl-test-limit";
    const ip = "10.0.0.2";
    // First 3 should be allowed
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(makeReq(ip, path), 3, 60_000)).toBeNull();
    }
    // 4th should be limited
    const limited = checkRateLimit(makeReq(ip, path), 3, 60_000);
    expect(limited).not.toBeNull();
    expect(limited?.status).toBe(429);
  });

  it("returns 429 with correct headers when rate limited", async () => {
    const path = "/api/rl-test-headers";
    const ip = "10.0.0.3";
    // Burn through the limit (1 req max)
    checkRateLimit(makeReq(ip, path), 1, 60_000);
    const limited = checkRateLimit(makeReq(ip, path), 1, 60_000);
    expect(limited?.status).toBe(429);
    const body = await limited!.json();
    expect(body.error).toMatch(/too many requests/i);
    expect(limited?.headers.get("Retry-After")).toBeTruthy();
    expect(limited?.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(limited?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("gives independent counters to different IPs", () => {
    const path = "/api/rl-test-multi-ip";
    // ip-A hits limit
    checkRateLimit(makeReq("10.1.0.1", path), 1, 60_000);
    expect(checkRateLimit(makeReq("10.1.0.1", path), 1, 60_000)?.status).toBe(429);
    // ip-B should still be allowed
    expect(checkRateLimit(makeReq("10.1.0.2", path), 1, 60_000)).toBeNull();
  });
});

// ── checkRateLimitAsync (no Upstash → falls back to in-memory) ──────────────

describe("checkRateLimitAsync", () => {
  it("allows first request on general bucket", async () => {
    const result = await checkRateLimitAsync(makeReq("10.2.0.1", "/api/rl-async-general"), "general");
    expect(result).toBeNull();
  });

  it("allows first request on refund bucket (5/hr limit)", async () => {
    const result = await checkRateLimitAsync(makeReq("10.2.0.2", "/api/rl-async-refund"), "refund");
    expect(result).toBeNull();
  });

  it("allows first request on mutation bucket (30/min limit)", async () => {
    const result = await checkRateLimitAsync(makeReq("10.2.0.3", "/api/rl-async-mutation"), "mutation");
    expect(result).toBeNull();
  });

  it("returns 429 after mutation bucket is exhausted", async () => {
    const ip = "10.2.0.10";
    const path = "/api/rl-async-mutation-burst";
    // Exhaust 30 req limit
    for (let i = 0; i < 30; i++) {
      await checkRateLimitAsync(makeReq(ip, path), "mutation");
    }
    const limited = await checkRateLimitAsync(makeReq(ip, path), "mutation");
    expect(limited?.status).toBe(429);
  });
});
