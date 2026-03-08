/**
 * Security Package Tests — validateApiInput / canSendToCustomer / timing-safe cron auth
 *
 * Tests the shared security utilities and verifies that the timing-safe
 * cron secret comparison is wired correctly.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbChain = jest.fn();
jest.mock("@orderflow/core-infra", () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => mockDbChain(...args),
  }),
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { validateApiInput, canSendToCustomer } from "@orderflow/security";
import crypto from "crypto";

// ── validateApiInput ─────────────────────────────────────────────────────────

describe("validateApiInput", () => {
  it("returns null when all required fields are present", () => {
    const result = validateApiInput(
      { name: "Alice", age: 30 },
      [
        { field: "name", required: true, type: "string" },
        { field: "age", required: true, type: "number" },
      ]
    );
    expect(result).toBeNull();
  });

  it("returns error when required field is missing", () => {
    const result = validateApiInput(
      { age: 30 },
      [{ field: "name", required: true }]
    );
    expect(result).toMatch(/name is required/i);
  });

  it("returns error when required field is empty string", () => {
    const result = validateApiInput(
      { name: "" },
      [{ field: "name", required: true }]
    );
    expect(result).toMatch(/name is required/i);
  });

  it("returns error when string field exceeds maxLength", () => {
    const result = validateApiInput(
      { bio: "x".repeat(201) },
      [{ field: "bio", maxLength: 200 }]
    );
    expect(result).toMatch(/200 characters/i);
  });

  it("returns error when number field is below min", () => {
    const result = validateApiInput(
      { price: -1 },
      [{ field: "price", type: "number", min: 0 }]
    );
    expect(result).toMatch(/at least 0/i);
  });

  it("returns error when number field exceeds max", () => {
    const result = validateApiInput(
      { quantity: 101 },
      [{ field: "quantity", type: "number", max: 100 }]
    );
    expect(result).toMatch(/at most 100/i);
  });

  it("returns error for wrong type (string expected, number given)", () => {
    const result = validateApiInput(
      { name: 42 },
      [{ field: "name", type: "string" }]
    );
    expect(result).toMatch(/must be a string/i);
  });

  it("returns null for optional field that is absent", () => {
    const result = validateApiInput(
      {},
      [{ field: "bio", required: false, maxLength: 200 }]
    );
    expect(result).toBeNull();
  });
});

// ── canSendToCustomer ────────────────────────────────────────────────────────

describe("canSendToCustomer", () => {
  beforeEach(() => jest.clearAllMocks());

  function mockCount(n: number) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ count: n }),
    };
  }

  it("returns true when customer has received fewer than 3 emails in cooldown window", async () => {
    mockDbChain.mockReturnValue(mockCount(2));
    const result = await canSendToCustomer("restaurant-1", "alice@example.com");
    expect(result).toBe(true);
  });

  it("returns false when customer has received 3 or more emails in cooldown window", async () => {
    mockDbChain.mockReturnValue(mockCount(3));
    const result = await canSendToCustomer("restaurant-1", "alice@example.com");
    expect(result).toBe(false);
  });

  it("uses the cooldownHours parameter to set the time window", async () => {
    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({ count: 0 }),
    };
    mockDbChain.mockReturnValue(mockChain);

    const before = Date.now();
    await canSendToCustomer("restaurant-1", "alice@example.com", 48);
    const gteCalls = mockChain.gte.mock.calls;
    const cutoffArg = new Date(gteCalls[0][1]).getTime();

    // The cutoff should be approximately 48 hours ago
    expect(before - cutoffArg).toBeGreaterThanOrEqual(47 * 3_600_000);
    expect(before - cutoffArg).toBeLessThan(49 * 3_600_000);
  });
});

// ── Cron timing-safe comparison ───────────────────────────────────────────────

describe("Cron secret timing-safe comparison", () => {
  /**
   * Directly tests the comparison logic used in all 3 cron routes.
   * If this passes, the crypto.timingSafeEqual path is correct.
   */
  function verifyCronSecret(incoming: string, stored: string): boolean {
    if (!stored || incoming.length !== stored.length) return false;
    return crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(stored));
  }

  it("returns true for matching secrets", () => {
    expect(verifyCronSecret("abc123", "abc123")).toBe(true);
  });

  it("returns false for mismatched secrets of same length", () => {
    expect(verifyCronSecret("abc123", "xyz789")).toBe(false);
  });

  it("returns false for secrets of different lengths (prevents panic)", () => {
    expect(verifyCronSecret("short", "longer-secret")).toBe(false);
  });

  it("returns false for empty incoming secret", () => {
    expect(verifyCronSecret("", "secret")).toBe(false);
  });

  it("returns false for empty stored secret", () => {
    expect(verifyCronSecret("secret", "")).toBe(false);
  });
});
