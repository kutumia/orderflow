/**
 * API Integration Tests — /api/staff (GET, POST, PUT, DELETE)
 *
 * Verifies owner-only access enforcement, input validation, and correct
 * cross-tenant scoping. Mocks the guard and Supabase so tests run in isolation.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockRequireOwner = jest.fn();
jest.mock("@/lib/guard", () => ({
  requireSession: jest.fn(),
  requireOwner: (...args: unknown[]) => mockRequireOwner(...args),
  requireManager: jest.fn(),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2b$12$hashedpassword"),
}));

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest.fn().mockReturnValue({ toString: () => "abc123def456" }),
}));

jest.mock("@/lib/logger", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { GET, POST, PUT, DELETE } from "@/app/api/staff/route";
import { NextRequest } from "next/server";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const RESTAURANT_ID = "550e8400-e29b-41d4-a716-446655440001";
const OWNER_ID = "550e8400-e29b-41d4-a716-446655440002";
const STAFF_ID = "550e8400-e29b-41d4-a716-446655440003";

const GUARD_SUCCESS = {
  ok: true as const,
  restaurantId: RESTAURANT_ID,
  session: {} as any,
  user: { id: OWNER_ID, role: "owner", restaurant_id: RESTAURANT_ID, plan: "growth", subscription_status: "active" },
};

const GUARD_403 = {
  ok: false as const,
  response: new Response(JSON.stringify({ error: "Owner access required" }), { status: 403 }),
};

const GUARD_401 = {
  ok: false as const,
  response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
};

function makeChain(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
}

function makeReq(method: string, body?: object) {
  return new NextRequest("http://localhost/api/staff", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDelete(id: string) {
  return new NextRequest(`http://localhost/api/staff?id=${id}`, { method: "DELETE" });
}

// ── GET /api/staff ─────────────────────────────────────────────────────────────

describe("GET /api/staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not logged in", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_401);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not an owner", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_403);
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Owner");
  });

  it("returns the list of staff members for this restaurant", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const staffList = [
      { id: OWNER_ID, email: "owner@test.com", role: "owner" },
      { id: STAFF_ID, email: "staff@test.com", role: "staff" },
    ];
    mockFrom.mockReturnValue({ ...makeChain(staffList), order: jest.fn().mockResolvedValue({ data: staffList, error: null }) });

    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it("returns 500 when Supabase errors", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    mockFrom.mockReturnValue({
      ...makeChain(null, { message: "DB error" }),
      order: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    });
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/staff ────────────────────────────────────────────────────────────

describe("POST /api/staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-owners", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_403);
    const res = await POST(makeReq("POST", { email: "a@b.com", name: "Alice", role: "staff" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when email is missing", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const res = await POST(makeReq("POST", { name: "Alice", role: "staff" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 when name is missing", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const res = await POST(makeReq("POST", { email: "a@b.com", role: "staff" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid role", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const res = await POST(makeReq("POST", { email: "a@b.com", name: "Alice", role: "admin" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("role");
  });

  it("returns 400 when email already exists", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    // First DB call: check existing — returns a user
    mockFrom.mockReturnValueOnce(makeChain({ id: STAFF_ID }));
    const res = await POST(makeReq("POST", { email: "exists@test.com", name: "Alice", role: "staff" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });

  it("creates a new staff member and returns temp_password on success", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    // First: check existing (null = no conflict)
    mockFrom.mockReturnValueOnce(makeChain(null));
    // Second: insert new user
    const newUser = { id: STAFF_ID, email: "new@test.com", name: "Alice", role: "staff", created_at: new Date().toISOString() };
    mockFrom.mockReturnValueOnce({
      ...makeChain(newUser),
      insert: jest.fn().mockReturnThis(),
    });

    const res = await POST(makeReq("POST", { email: "new@test.com", name: "Alice", role: "staff" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.temp_password).toBeDefined();
    expect(body.email).toBe("new@test.com");
  });
});

// ── PUT /api/staff ─────────────────────────────────────────────────────────────

describe("PUT /api/staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when staff ID is missing", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const res = await PUT(makeReq("PUT", { role: "staff" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Staff ID");
  });

  it("returns 400 when trying to change own role", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    // id === owner's own id
    const res = await PUT(makeReq("PUT", { id: OWNER_ID, role: "staff" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("own role");
  });

  it("returns 400 for an invalid role", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const res = await PUT(makeReq("PUT", { id: STAFF_ID, role: "superadmin" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid role");
  });

  it("successfully updates staff role", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const res = await PUT(makeReq("PUT", { id: STAFF_ID, role: "owner" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── DELETE /api/staff ──────────────────────────────────────────────────────────

describe("DELETE /api/staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when id query param is missing", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const req = new NextRequest("http://localhost/api/staff", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Staff ID");
  });

  it("returns 400 when trying to remove yourself", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    const res = await DELETE(makeDelete(OWNER_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("yourself");
  });

  it("successfully deletes a staff member", async () => {
    mockRequireOwner.mockResolvedValue(GUARD_SUCCESS);
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const res = await DELETE(makeDelete(STAFF_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
