/**
 * API Integration Tests — GET /api/orders and PUT /api/orders
 *
 * Tests the orders route handler in isolation with mocked guard and Supabase.
 * Verifies authentication enforcement, query parameter handling, status
 * validation, and proper restaurant_id scoping.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockRequireSession = jest.fn();
jest.mock("@/lib/guard", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  requireOwner: jest.fn(),
  requireManager: jest.fn(),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock("@/lib/stripe", () => ({
  refundPayment: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/logger", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { GET, PUT } from "@/app/api/orders/route";
import { NextRequest } from "next/server";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const RESTAURANT_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_ID = "550e8400-e29b-41d4-a716-446655440002";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440003";

const GUARD_SUCCESS = {
  ok: true as const,
  restaurantId: RESTAURANT_ID,
  session: {} as any,
  user: { id: USER_ID, role: "owner", restaurant_id: RESTAURANT_ID, plan: "growth", subscription_status: "active" },
};

const GUARD_401 = {
  ok: false as const,
  response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
};

/** A fluent Supabase chain for SELECT queries with pagination. */
function mockSelectChain(data: unknown[], count = 0, error: unknown = null) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data, error, count }),
    single: jest.fn().mockResolvedValue({ data: data[0] ?? null, error }),
  };
  return chain;
}

function mockUpdateChain(error: unknown = null) {
  return {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    then: jest.fn().mockResolvedValue({ error }),
    // Supabase update().eq().eq() resolves to { error }
    select: jest.fn().mockReturnThis(),
  };
}

function mockInsertChain(error: unknown = null) {
  return {
    insert: jest.fn().mockResolvedValue({ error }),
  };
}

function makeGet(params = "") {
  return new NextRequest(`http://localhost/api/orders${params ? `?${params}` : ""}`);
}

function makePut(body: object) {
  return new NextRequest("http://localhost/api/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── GET /api/orders ────────────────────────────────────────────────────────────

describe("GET /api/orders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when guard rejects the request", async () => {
    mockRequireSession.mockResolvedValue(GUARD_401);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns paginated orders with total count on success", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const orders = [
      { id: ORDER_ID, status: "pending", total: 1500 },
      { id: "order-2", status: "confirmed", total: 2000 },
    ];
    const chain = mockSelectChain(orders, 2);
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
  });

  it("applies 'live' filter to only return active orders", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const chain = mockSelectChain([]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGet("filter=live"));
    // Verify .in() was called (for status filter)
    expect(chain.in).toHaveBeenCalledWith(
      "status",
      expect.arrayContaining(["pending", "confirmed"])
    );
  });

  it("applies 'today' filter correctly", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const chain = mockSelectChain([]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGet("filter=today"));
    expect(chain.gte).toHaveBeenCalled();
  });

  it("applies custom date range for filter=all", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const chain = mockSelectChain([]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGet("filter=all&from=2025-01-01&to=2025-01-31"));
    expect(chain.gte).toHaveBeenCalled();
    expect(chain.lte).toHaveBeenCalled();
  });

  it("clamps limit to maximum of 100", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const chain = mockSelectChain([]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGet("limit=999"));
    // range(0, 99) — limit clamped to 100
    expect(chain.range).toHaveBeenCalledWith(0, 99);
  });

  it("returns 500 when Supabase query fails", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const chain = mockSelectChain([], 0, { message: "Connection timeout" });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeGet());
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/orders ────────────────────────────────────────────────────────────

describe("PUT /api/orders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when guard rejects the request", async () => {
    mockRequireSession.mockResolvedValue(GUARD_401);
    const res = await PUT(makePut({ order_id: ORDER_ID, status: "confirmed" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when order_id is missing", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const res = await PUT(makePut({ status: "confirmed" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Order ID");
  });

  it("returns 400 when status is missing", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const res = await PUT(makePut({ order_id: ORDER_ID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status value", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    const res = await PUT(makePut({ order_id: ORDER_ID, status: "exploded" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid status");
  });

  it("returns 404 when the order does not belong to this restaurant", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
    // DB returns null — order not found for this restaurant
    const selectChain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null }),
    };
    mockFrom.mockReturnValue(selectChain);

    const res = await PUT(makePut({ order_id: ORDER_ID, status: "confirmed" }));
    expect(res.status).toBe(404);
  });

  it("successfully updates order status to 'confirmed' and logs history", async () => {
    mockRequireSession.mockResolvedValue(GUARD_SUCCESS);

    const order = { id: ORDER_ID, status: "pending", stripe_payment_intent_id: null };

    // First call: fetch order; second call: update order; third call: insert history
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === "orders" && callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: order }),
        };
      }
      if (table === "orders" && callCount === 2) {
        return {
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      // order_status_history insert
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const res = await PUT(makePut({ order_id: ORDER_ID, status: "confirmed" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("accepts all valid status values", async () => {
    const validStatuses = [
      "confirmed", "preparing", "ready", "out_for_delivery",
      "delivered", "collected", "cancelled",
    ];

    for (const status of validStatuses) {
      mockRequireSession.mockResolvedValue(GUARD_SUCCESS);
      const order = { id: ORDER_ID, status: "pending", stripe_payment_intent_id: null };

      mockFrom
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: order }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        });

      const res = await PUT(makePut({ order_id: ORDER_ID, status }));
      expect(res.status).not.toBe(400);
    }
  });
});
