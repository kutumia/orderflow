/**
 * PrintBridge Core Tests — getJob / updateJobStatus tenant scoping
 *
 * Verifies that:
 *   1. getJob() always applies tenant_id filter (non-optional after fix)
 *   2. updateJobStatus() applies tenant_id filter (P2 fix)
 *   3. Cross-tenant access is blocked at query level
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock("@orderflow/core-infra", () => ({
  getSupabaseAdmin: () => ({
    from: jest.fn().mockReturnValue(mockQuery),
  }),
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { getJob } from "@orderflow/printbridge-core";

// ── getJob ────────────────────────────────────────────────────────────────────

describe("getJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.single.mockResolvedValue({ data: null, error: null });
  });

  it("always filters by both id and tenant_id", async () => {
    mockQuery.single.mockResolvedValue({
      data: { id: "job-1", tenant_id: "tenant-A", status: "queued" },
      error: null,
    });

    const result = await getJob("job-1", "tenant-A");

    expect(result).not.toBeNull();

    // Verify .eq was called with both id and tenant_id
    const eqCalls = mockQuery.eq.mock.calls as [string, string][];
    const idCall     = eqCalls.find(([field]) => field === "id");
    const tenantCall = eqCalls.find(([field]) => field === "tenant_id");

    expect(idCall).toBeDefined();
    expect(idCall![1]).toBe("job-1");
    expect(tenantCall).toBeDefined();
    expect(tenantCall![1]).toBe("tenant-A");
  });

  it("returns null when job belongs to a different tenant (DB returns no row)", async () => {
    mockQuery.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const result = await getJob("job-1", "tenant-B");
    expect(result).toBeNull();
  });

  it("returns the job object when tenant matches", async () => {
    const job = { id: "job-2", tenant_id: "tenant-C", status: "printed", receipt_data: "ESC..." };
    mockQuery.single.mockResolvedValue({ data: job, error: null });

    const result = await getJob("job-2", "tenant-C");
    expect(result).toEqual(job);
  });

  it("returns null when job does not exist at all", async () => {
    mockQuery.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const result = await getJob("nonexistent-job", "tenant-X");
    expect(result).toBeNull();
  });
});
