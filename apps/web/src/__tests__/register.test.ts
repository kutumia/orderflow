/**
 * API Integration Tests — POST /api/register
 *
 * Verifies input validation (Zod schema), duplicate email detection,
 * atomic creation via stored procedure, and fallback to sequential inserts.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2b$12$hashedpassword"),
}));

jest.mock("@/lib/utils", () => ({
  generateSlug: jest.fn((name: string) => name.toLowerCase().replace(/\s+/g, "-")),
  makeSlugUnique: jest.fn((slug: string) => `${slug}-abc1`),
}));

jest.mock("@/lib/logger", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { POST } from "@/app/api/register/route";
import { NextRequest } from "next/server";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  restaurantName: "Mario's Pizza",
  ownerName: "Mario Rossi",
  email: "mario@example.com",
  password: "securepassword123",
};

/** Builds a chain returning null (record not found) — used for duplicate checks. */
function noConflict() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
}

/** Builds a chain returning a record — used to simulate duplicates. */
function withRecord(data: object) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: null }),
  };
}

// ── Input validation (Zod schema) ──────────────────────────────────────────────

describe("POST /api/register — input validation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when restaurantName is empty", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, restaurantName: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 when ownerName is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, ownerName: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid email address", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, email: "notanemail" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("email");
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("8 characters");
  });

  it("returns 400 when restaurantName exceeds 100 characters", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, restaurantName: "A".repeat(101) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    const longEmail = "a".repeat(250) + "@b.com";
    const res = await POST(makeReq({ ...VALID_BODY, email: longEmail }));
    expect(res.status).toBe(400);
  });
});

// ── Duplicate detection ────────────────────────────────────────────────────────

describe("POST /api/register — duplicate detection", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 409 when email is already registered", async () => {
    mockFrom.mockReturnValue(withRecord({ id: "existing-user-id" }));
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });
});

// ── Successful registration via RPC ────────────────────────────────────────────

describe("POST /api/register — successful registration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls the stored procedure and returns 201 with restaurant data", async () => {
    // No existing user, no existing slug
    mockFrom
      .mockReturnValueOnce(noConflict()) // users duplicate check
      .mockReturnValueOnce(noConflict()); // slug duplicate check

    mockRpc.mockResolvedValue({
      data: { restaurant_id: "new-rest-id", user_id: "new-user-id" },
      error: null,
    });

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("Account created");
    expect(body.restaurant.slug).toBeDefined();
    expect(mockRpc).toHaveBeenCalledWith(
      "create_restaurant_with_owner",
      expect.objectContaining({
        p_restaurant_name: "Mario's Pizza",
        p_owner_email: "mario@example.com",
      })
    );
  });

  it("generates a unique slug when the default slug is already taken", async () => {
    mockFrom
      .mockReturnValueOnce(noConflict())              // users check: clean
      .mockReturnValueOnce(withRecord({ id: "slug-taken" })); // slug: taken

    mockRpc.mockResolvedValue({
      data: { restaurant_id: "new-rest-id", user_id: "new-user-id" },
      error: null,
    });

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(201);
    // makeSlugUnique was mocked to return slug + "-abc1"
    const body = await res.json();
    expect(body.restaurant.slug).toContain("-abc1");
  });
});

// ── Fallback path (RPC not deployed) ──────────────────────────────────────────

describe("POST /api/register — sequential fallback when RPC is missing", () => {
  beforeEach(() => jest.clearAllMocks());

  it("falls back to sequential inserts when RPC returns code 42883", async () => {
    // No conflicts
    mockFrom
      .mockReturnValueOnce(noConflict()) // users check
      .mockReturnValueOnce(noConflict()); // slug check

    // RPC not found
    mockRpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function not found" } });

    // Fallback: restaurant insert
    mockFrom.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "rest-id", slug: "marios-pizza", name: "Mario's Pizza" },
        error: null,
      }),
    });
    // User insert
    mockFrom.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "user-id" },
        error: null,
      }),
    });
    // Promise.all: update restaurant owner_id
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("Account created");
  });

  it("returns 500 when RPC fails with a non-42883 error", async () => {
    mockFrom
      .mockReturnValueOnce(noConflict())
      .mockReturnValueOnce(noConflict());

    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "Permission denied" },
    });

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
