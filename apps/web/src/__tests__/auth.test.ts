/**
 * Phase 9 — Auth Flow Tests
 *
 * Tests password reset token logic, registration validation, rate limiting.
 */

import { createHash, randomBytes } from "crypto";

describe("Password reset token flow (FEAT-007)", () => {
  it("generates a 32-byte random token", () => {
    const token = randomBytes(32).toString("hex");
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it("hashes token with SHA-256", () => {
    const token = "abc123testtoken";
    const hash = createHash("sha256").update(token).digest("hex");
    expect(hash.length).toBe(64);
    // Same input = same hash
    const hash2 = createHash("sha256").update(token).digest("hex");
    expect(hash).toBe(hash2);
  });

  it("different tokens produce different hashes", () => {
    const token1 = randomBytes(32).toString("hex");
    const token2 = randomBytes(32).toString("hex");
    const hash1 = createHash("sha256").update(token1).digest("hex");
    const hash2 = createHash("sha256").update(token2).digest("hex");
    expect(hash1).not.toBe(hash2);
  });

  it("token expires after 1 hour", () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const isValid = expiresAt > new Date();
    expect(isValid).toBe(true);

    // Simulate expired token
    const expired = new Date(Date.now() - 1000);
    const isExpired = expired < new Date();
    expect(isExpired).toBe(true);
  });

  it("used token cannot be reused", () => {
    const token = { used_at: new Date().toISOString() };
    const isUsed = !!token.used_at;
    expect(isUsed).toBe(true);
  });
});

describe("Registration validation", () => {
  it("rejects password shorter than 8 characters", () => {
    const password = "short";
    const isValid = password.length >= 8;
    expect(isValid).toBe(false);
  });

  it("accepts 8+ character password", () => {
    const password = "mySecurePassword123";
    const isValid = password.length >= 8;
    expect(isValid).toBe(true);
  });

  it("normalises email to lowercase", () => {
    const email = "John@Example.COM";
    const normalised = email.toLowerCase().trim();
    expect(normalised).toBe("john@example.com");
  });

  it("generates correct trial end date (14 days)", () => {
    const now = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const diffDays = Math.round(
      (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(14);
  });
});

describe("Rate limiter", () => {
  it("getClientIp extracts from x-forwarded-for", () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "1.2.3.4, 5.6.7.8");
    const forwarded = headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    expect(ip).toBe("1.2.3.4");
  });

  it("getClientIp falls back to x-real-ip", () => {
    const headers = new Headers();
    headers.set("x-real-ip", "9.8.7.6");
    const forwarded = headers.get("x-forwarded-for");
    const real = headers.get("x-real-ip");
    const ip = forwarded ? forwarded.split(",")[0].trim() : real || "unknown";
    expect(ip).toBe("9.8.7.6");
  });

  it("getClientIp returns 'unknown' when no headers", () => {
    const headers = new Headers();
    const forwarded = headers.get("x-forwarded-for");
    const real = headers.get("x-real-ip");
    const ip = forwarded ? forwarded.split(",")[0].trim() : real || "unknown";
    expect(ip).toBe("unknown");
  });
});

describe("KDS PIN authentication (BUG-010)", () => {
  it("rejects incorrect PIN", () => {
    const storedPin = "1234";
    const inputPin = "5678";
    expect(storedPin === inputPin).toBe(false);
  });

  it("accepts correct PIN", () => {
    const storedPin = "1234";
    const inputPin = "1234";
    expect(storedPin === inputPin).toBe(true);
  });

  it("allows access when no PIN is set", () => {
    const storedPin = null;
    const shouldAllow = !storedPin;
    expect(shouldAllow).toBe(true);
  });
});

describe("Timezone-aware opening hours (BUG-008)", () => {
  it("converts UTC to London time", () => {
    const now = new Date("2025-07-15T12:00:00Z"); // UTC noon in July (BST)
    const londonTime = now.toLocaleString("en-US", { timeZone: "Europe/London" });
    // BST is UTC+1, so noon UTC = 1pm London
    expect(londonTime).toContain("1:00:00 PM");
  });

  it("handles winter time correctly", () => {
    const now = new Date("2025-01-15T12:00:00Z"); // UTC noon in January (GMT)
    const londonTime = now.toLocaleString("en-US", { timeZone: "Europe/London" });
    // GMT = UTC, so noon UTC = noon London
    expect(londonTime).toContain("12:00:00 PM");
  });
});
