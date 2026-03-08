/**
 * Auth Guard Tests — requireSession / requireOwner / requireManager
 *
 * Tests the actual security logic in lib/guard.ts that protects every
 * dashboard API route. Every guard must:
 *   1. Reject requests with no session (401)
 *   2. Reject requests where the session signals the account is gone (401)
 *   3. Reject requests where the user is no longer in the DB (401)
 *   4. Reject requests where the JWT restaurant_id doesn't match DB (403)
 *   5. Return restaurantId + typed user data when everything checks out
 *
 * requireOwner additionally enforces role === "owner".
 * requireManager additionally enforces role in ["owner", "manager"].
 */

// ── Mocks (hoisted above imports by Jest) ─────────────────────────────────────

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockDbChain = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockDbChain(...args),
  },
}));

jest.mock("@/lib/logger", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { requireSession, requireOwner, requireManager } from "@/lib/guard";
import { NextRequest } from "next/server";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const RESTAURANT_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_ID = "550e8400-e29b-41d4-a716-446655440002";

const VALID_SESSION = {
  user: {
    id: USER_ID,
    email: "owner@test.com",
    name: "Test Owner",
    restaurant_id: RESTAURANT_ID,
    restaurant_slug: "test-pizza",
    restaurant_name: "Test Pizza",
    role: "owner" as const,
    plan: "growth",
    subscription_status: "active" as const,
    trial_ends_at: null,
  },
};

const VALID_DB_USER = {
  id: USER_ID,
  role: "owner",
  restaurant_id: RESTAURANT_ID,
};

/** Builds a fluent Supabase mock chain whose .single() resolves to { data, error }. */
function mockSingle(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
}

function makeReq() {
  return new NextRequest("http://localhost/api/test");
}

// ── requireSession ─────────────────────────────────────────────────────────────

describe("requireSession", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when getServerSession returns null (not logged in)", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 401 with 'Session expired' body when session.error is UserNotFound", async () => {
    mockGetServerSession.mockResolvedValue({
      ...VALID_SESSION,
      error: "UserNotFound",
    });
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.error).toBe("Session expired");
    }
  });

  it("returns 401 when user is no longer in the DB (account deleted after login)", async () => {
    mockGetServerSession.mockResolvedValue(VALID_SESSION);
    mockDbChain.mockReturnValue(mockSingle(null)); // DB has no record
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 403 when JWT restaurant_id does not match DB restaurant_id (JWT tampering guard)", async () => {
    mockGetServerSession.mockResolvedValue(VALID_SESSION);
    mockDbChain.mockReturnValue(
      mockSingle({ ...VALID_DB_USER, restaurant_id: "attacker-restaurant-id" })
    );
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("returns ok=true with restaurantId and user when everything is valid", async () => {
    mockGetServerSession.mockResolvedValue(VALID_SESSION);
    mockDbChain.mockReturnValue(mockSingle(VALID_DB_USER));
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.restaurantId).toBe(RESTAURANT_ID);
      expect(result.user.id).toBe(USER_ID);
      expect(result.user.role).toBe("owner");
      expect(result.user.restaurant_id).toBe(RESTAURANT_ID);
    }
  });

  it("surfaces plan and subscription_status from the JWT session onto the guard result", async () => {
    const session = {
      ...VALID_SESSION,
      user: {
        ...VALID_SESSION.user,
        plan: "starter",
        subscription_status: "trialing" as const,
      },
    };
    mockGetServerSession.mockResolvedValue(session);
    mockDbChain.mockReturnValue(mockSingle(VALID_DB_USER));
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.plan).toBe("starter");
      expect(result.user.subscription_status).toBe("trialing");
    }
  });

  it("uses DB role (not JWT role) for the returned user object", async () => {
    // JWT says "owner" but DB says "staff" — DB wins
    mockGetServerSession.mockResolvedValue(VALID_SESSION);
    mockDbChain.mockReturnValue(
      mockSingle({ ...VALID_DB_USER, role: "staff" })
    );
    const result = await requireSession(makeReq());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.role).toBe("staff");
    }
  });
});

// ── requireOwner ───────────────────────────────────────────────────────────────

describe("requireOwner", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 with 'Owner access required' when user is staff", async () => {
    mockGetServerSession.mockResolvedValue({
      ...VALID_SESSION,
      user: { ...VALID_SESSION.user, role: "staff" as const },
    });
    mockDbChain.mockReturnValue(mockSingle({ ...VALID_DB_USER, role: "staff" }));
    const result = await requireOwner(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("Owner");
    }
  });

  it("returns 403 when user is manager (managers cannot perform owner-only actions)", async () => {
    mockGetServerSession.mockResolvedValue({
      ...VALID_SESSION,
      user: { ...VALID_SESSION.user, role: "manager" as const },
    });
    mockDbChain.mockReturnValue(mockSingle({ ...VALID_DB_USER, role: "manager" }));
    const result = await requireOwner(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("returns ok=true for an owner", async () => {
    mockGetServerSession.mockResolvedValue(VALID_SESSION);
    mockDbChain.mockReturnValue(mockSingle(VALID_DB_USER));
    const result = await requireOwner(makeReq());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe("owner");
  });

  it("inherits 401 from requireSession when there is no session at all", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const result = await requireOwner(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

// ── requireManager ─────────────────────────────────────────────────────────────

describe("requireManager", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 with 'Manager access required' when user is staff", async () => {
    mockGetServerSession.mockResolvedValue({
      ...VALID_SESSION,
      user: { ...VALID_SESSION.user, role: "staff" as const },
    });
    mockDbChain.mockReturnValue(mockSingle({ ...VALID_DB_USER, role: "staff" }));
    const result = await requireManager(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("Manager");
    }
  });

  it("returns ok=true for a manager", async () => {
    mockGetServerSession.mockResolvedValue({
      ...VALID_SESSION,
      user: { ...VALID_SESSION.user, role: "manager" as const },
    });
    mockDbChain.mockReturnValue(mockSingle({ ...VALID_DB_USER, role: "manager" }));
    const result = await requireManager(makeReq());
    expect(result.ok).toBe(true);
  });

  it("returns ok=true for an owner (owners have all manager privileges)", async () => {
    mockGetServerSession.mockResolvedValue(VALID_SESSION);
    mockDbChain.mockReturnValue(mockSingle(VALID_DB_USER));
    const result = await requireManager(makeReq());
    expect(result.ok).toBe(true);
  });

  it("inherits 401 from requireSession when there is no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const result = await requireManager(makeReq());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});
