/**
 * Phase 9 — Utility Tests
 * Tests: generateSlug, makeSlugUnique, formatPrice, formatDate, formatDateTime,
 *        isValidEmail, isValidUKPhone, trialDaysRemaining, getDayName
 */

import {
  generateSlug,
  makeSlugUnique,
  formatPrice,
  formatDate,
  formatDateTime,
  isValidEmail,
  isValidUKPhone,
  cn,
  getDayName,
  trialDaysRemaining,
} from "@/lib/utils";

import {
  escapeHtml,
  stripControlChars,
  validateLength,
  validateEmail,
  validatePhone,
  isValidUUID,
  validateCheckoutInput,
} from "@/lib/validation";

// ── generateSlug ──
describe("generateSlug", () => {
  it("converts basic name to slug", () => {
    expect(generateSlug("Mario's Pizza")).toBe("marios-pizza");
  });

  it("converts & to 'and'", () => {
    expect(generateSlug("Fish & Chips")).toBe("fish-and-chips");
  });

  it("handles unicode characters", () => {
    expect(generateSlug("Café Résumé")).toBe("caf-rsum");
  });

  it("trims leading/trailing hyphens", () => {
    expect(generateSlug("--test--")).toBe("test");
  });

  it("truncates to 60 characters", () => {
    const longName = "A".repeat(100);
    expect(generateSlug(longName).length).toBeLessThanOrEqual(60);
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });

  it("handles special characters", () => {
    expect(generateSlug("Pizza!!! @Home #1")).toBe("pizza-home-1");
  });
});

describe("makeSlugUnique", () => {
  it("adds a suffix", () => {
    const result = makeSlugUnique("test");
    expect(result).toMatch(/^test-[a-z0-9]{4}$/);
  });

  it("produces different suffixes", () => {
    const a = makeSlugUnique("test");
    const b = makeSlugUnique("test");
    // Very unlikely to be the same
    expect(a).not.toBe(b);
  });
});

// ── formatPrice ──
describe("formatPrice", () => {
  it("formats pence to pounds", () => {
    expect(formatPrice(1299)).toBe("£12.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("£0.00");
  });

  it("formats single pence", () => {
    expect(formatPrice(1)).toBe("£0.01");
  });

  it("formats large amounts", () => {
    expect(formatPrice(999999)).toBe("£9999.99");
  });
});

// ── isValidEmail ──
describe("isValidEmail", () => {
  it("accepts valid email", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(isValidEmail("user@mail.example.com")).toBe(true);
  });

  it("rejects no @", () => {
    expect(isValidEmail("testexample.com")).toBe(false);
  });

  it("rejects no domain", () => {
    expect(isValidEmail("test@")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidEmail("test @example.com")).toBe(false);
  });
});

// ── isValidUKPhone ──
describe("isValidUKPhone", () => {
  it("accepts 07 number", () => {
    expect(isValidUKPhone("07123456789")).toBe(true);
  });

  it("accepts +44 number", () => {
    expect(isValidUKPhone("+447123456789")).toBe(true);
  });

  it("accepts formatted number", () => {
    expect(isValidUKPhone("0712 345 6789")).toBe(true);
  });

  it("rejects short number", () => {
    expect(isValidUKPhone("0712345")).toBe(false);
  });

  it("rejects US number", () => {
    expect(isValidUKPhone("+12125551234")).toBe(false);
  });
});

// ── getDayName ──
describe("getDayName", () => {
  it("returns Sunday for 0", () => {
    expect(getDayName(0)).toBe("Sunday");
  });

  it("returns Saturday for 6", () => {
    expect(getDayName(6)).toBe("Saturday");
  });

  it("returns empty for invalid", () => {
    expect(getDayName(7)).toBe("");
  });
});

// ── trialDaysRemaining ──
describe("trialDaysRemaining", () => {
  it("returns positive days for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(trialDaysRemaining(future.toISOString())).toBeGreaterThanOrEqual(6);
    expect(trialDaysRemaining(future.toISOString())).toBeLessThanOrEqual(8);
  });

  it("returns 0 for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(trialDaysRemaining(past.toISOString())).toBe(0);
  });
});

// ── cn ──
describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

// ══════════════════════════════════════
// Validation.ts tests
// ══════════════════════════════════════

describe("escapeHtml", () => {
  it("escapes < and >", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
    );
  });

  it("escapes &", () => {
    expect(escapeHtml("Fish & Chips")).toBe("Fish &amp; Chips");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(escapeHtml(null as any)).toBe("");
    expect(escapeHtml(undefined as any)).toBe("");
  });
});

describe("stripControlChars", () => {
  it("strips null bytes", () => {
    expect(stripControlChars("hello\x00world")).toBe("helloworld");
  });

  it("keeps newlines and tabs", () => {
    expect(stripControlChars("line1\nline2\ttab")).toBe("line1\nline2\ttab");
  });

  it("strips other control chars", () => {
    expect(stripControlChars("test\x01\x02\x03")).toBe("test");
  });
});

describe("validateLength", () => {
  it("returns null for valid input", () => {
    expect(validateLength("hello", "Name", 1, 100)).toBeNull();
  });

  it("rejects too short", () => {
    expect(validateLength("", "Name", 1, 100)).toBe("Name must be at least 1 character");
  });

  it("rejects too long", () => {
    expect(validateLength("a".repeat(101), "Name", 1, 100)).toBe(
      "Name must be 100 characters or fewer"
    );
  });

  it("rejects null", () => {
    expect(validateLength(null, "Name", 1, 100)).toBe("Name must be at least 1 character");
  });
});

describe("validateEmail (validation.ts)", () => {
  it("returns null for valid email", () => {
    expect(validateEmail("test@example.com")).toBeNull();
  });

  it("rejects empty", () => {
    expect(validateEmail("")).toBe("Email is required");
  });

  it("rejects too long", () => {
    expect(validateEmail("a".repeat(250) + "@b.com")).toBe("Email is too long");
  });

  it("rejects invalid format", () => {
    expect(validateEmail("notanemail")).toBe("Invalid email format");
  });
});

describe("validatePhone", () => {
  it("returns null for valid UK phone", () => {
    expect(validatePhone("07123456789")).toBeNull();
  });

  it("rejects empty", () => {
    expect(validatePhone("")).toBe("Phone number is required");
  });

  it("rejects too long", () => {
    expect(validatePhone("0".repeat(25))).toBe("Phone number is too long");
  });
});

describe("isValidUUID", () => {
  it("accepts valid UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects invalid", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isValidUUID("")).toBe(false);
  });
});

describe("validateCheckoutInput", () => {
  const validInput = {
    customer_name: "John Smith",
    customer_email: "john@example.com",
    customer_phone: "07123456789",
  };

  it("returns null for valid input", () => {
    expect(validateCheckoutInput(validInput)).toBeNull();
  });

  it("rejects missing name", () => {
    expect(validateCheckoutInput({ ...validInput, customer_name: "" })).toBe(
      "Name must be at least 1 character"
    );
  });

  it("rejects invalid email", () => {
    expect(validateCheckoutInput({ ...validInput, customer_email: "bad" })).toBe(
      "Invalid email format"
    );
  });

  it("rejects invalid phone", () => {
    expect(validateCheckoutInput({ ...validInput, customer_phone: "123" })).toBe(
      "Invalid UK phone number"
    );
  });

  it("rejects too-long address", () => {
    expect(
      validateCheckoutInput({ ...validInput, delivery_address: "a".repeat(501) })
    ).toBe("Delivery address must be 500 characters or fewer");
  });

  it("rejects too-long notes", () => {
    expect(
      validateCheckoutInput({ ...validInput, notes: "a".repeat(501) })
    ).toBe("Order notes must be 500 characters or fewer");
  });
});
