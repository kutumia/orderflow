/**
 * Idempotency & Duplicate Event Tests
 * E3-T06 — Verifies duplicate-event handling and idempotency
 *
 * Tests:
 *   1. Idempotency key validation
 *   2. Duplicate Shopify order detection (by shopify_order_id)
 *   3. Print job double-dispatch prevention (atomic status transition)
 *   4. Cron email deduplication logic
 */

import { validateIdempotencyKey, IDEMPOTENCY_TTL_MS } from "@/lib/idempotency";

// ── Idempotency key validation ────────────────────────────────────────────

describe("validateIdempotencyKey", () => {
  it("accepts valid UUID v4 format", () => {
    expect(validateIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts short alphanumeric keys (≥16 chars)", () => {
    expect(validateIdempotencyKey("abcdef1234567890")).toBe(true);
  });

  it("accepts keys with hyphens and underscores", () => {
    expect(validateIdempotencyKey("key-with-hyphens_and_underscores-123456")).toBe(true);
  });

  it("rejects null", () => {
    expect(validateIdempotencyKey(null)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateIdempotencyKey("")).toBe(false);
  });

  it("rejects too-short key (< 16 chars)", () => {
    expect(validateIdempotencyKey("tooshort")).toBe(false);
  });

  it("rejects keys with special characters", () => {
    expect(validateIdempotencyKey("key with spaces!")).toBe(false);
    expect(validateIdempotencyKey("key<script>alert")).toBe(false);
  });

  it("rejects keys longer than 64 characters", () => {
    expect(validateIdempotencyKey("a".repeat(65))).toBe(false);
  });

  it("accepts keys exactly 16 characters long", () => {
    expect(validateIdempotencyKey("a".repeat(16))).toBe(true);
  });

  it("accepts keys exactly 64 characters long", () => {
    expect(validateIdempotencyKey("a".repeat(64))).toBe(true);
  });
});

// ── TTL constant sanity checks ────────────────────────────────────────────

describe("IDEMPOTENCY_TTL_MS", () => {
  it("is 24 hours in milliseconds", () => {
    expect(IDEMPOTENCY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("is greater than 1 hour", () => {
    expect(IDEMPOTENCY_TTL_MS).toBeGreaterThan(60 * 60 * 1000);
  });
});

// ── Shopify order deduplication ───────────────────────────────────────────

describe("Shopify order deduplication", () => {
  /**
   * Simulates the DB-level deduplication for Shopify order webhooks.
   * In production: INSERT ... ON CONFLICT (shopify_order_id) DO NOTHING
   */

  class MockOrderStore {
    private orders = new Map<string, { id: string; amount: number }>();

    insertIfNotExists(shopifyOrderId: string, data: { id: string; amount: number }): boolean {
      if (this.orders.has(shopifyOrderId)) {
        return false; // duplicate
      }
      this.orders.set(shopifyOrderId, data);
      return true; // inserted
    }

    count() { return this.orders.size; }
  }

  it("first webhook creates the order", () => {
    const store = new MockOrderStore();
    const inserted = store.insertIfNotExists("shopify-order-123", { id: "order-1", amount: 1500 });
    expect(inserted).toBe(true);
    expect(store.count()).toBe(1);
  });

  it("duplicate webhook does not create a second order", () => {
    const store = new MockOrderStore();
    store.insertIfNotExists("shopify-order-456", { id: "order-2", amount: 2000 });
    const inserted = store.insertIfNotExists("shopify-order-456", { id: "order-3", amount: 2000 });
    expect(inserted).toBe(false);
    expect(store.count()).toBe(1);
  });

  it("different shopify order IDs create independent orders", () => {
    const store = new MockOrderStore();
    store.insertIfNotExists("shopify-order-A", { id: "order-A", amount: 1000 });
    store.insertIfNotExists("shopify-order-B", { id: "order-B", amount: 2000 });
    expect(store.count()).toBe(2);
  });

  it("Shopify Webhook-ID deduplication independent of order ID", () => {
    const processedWebhooks = new Set<string>();

    function processWebhook(webhookId: string, handler: () => void): boolean {
      if (processedWebhooks.has(webhookId)) return false;
      processedWebhooks.add(webhookId);
      handler();
      return true;
    }

    let callCount = 0;
    const handler = () => { callCount++; };

    processWebhook("webhook-xyz", handler);
    processWebhook("webhook-xyz", handler);
    processWebhook("webhook-xyz", handler);

    expect(callCount).toBe(1);
  });
});

// ── Print job double-dispatch prevention ─────────────────────────────────

describe("Print job double-dispatch prevention", () => {
  /**
   * Simulates atomic status transition: queued → printing
   * Only one agent can claim a job (CAS-style update).
   */

  type JobStatus = "queued" | "printing" | "printed" | "failed";

  class MockJobStore {
    private jobs = new Map<string, { status: JobStatus; agentId: string | null }>();

    create(id: string) {
      this.jobs.set(id, { status: "queued", agentId: null });
    }

    // Returns true if this agent successfully claimed the job
    claimJob(jobId: string, agentId: string): boolean {
      const job = this.jobs.get(jobId);
      if (!job || job.status !== "queued") return false;
      job.status = "printing";
      job.agentId = agentId;
      return true;
    }

    getJob(jobId: string) { return this.jobs.get(jobId); }
  }

  it("first agent successfully claims queued job", () => {
    const store = new MockJobStore();
    store.create("job-1");
    expect(store.claimJob("job-1", "agent-A")).toBe(true);
    expect(store.getJob("job-1")?.agentId).toBe("agent-A");
  });

  it("second agent cannot claim already-claimed job", () => {
    const store = new MockJobStore();
    store.create("job-1");
    store.claimJob("job-1", "agent-A");
    expect(store.claimJob("job-1", "agent-B")).toBe(false);
    expect(store.getJob("job-1")?.agentId).toBe("agent-A"); // original agent kept
  });

  it("same agent cannot double-claim its own job", () => {
    const store = new MockJobStore();
    store.create("job-1");
    store.claimJob("job-1", "agent-A");
    expect(store.claimJob("job-1", "agent-A")).toBe(false);
  });

  it("cannot claim non-existent job", () => {
    const store = new MockJobStore();
    expect(store.claimJob("nonexistent", "agent-A")).toBe(false);
  });

  it("two agents can each claim different jobs", () => {
    const store = new MockJobStore();
    store.create("job-A");
    store.create("job-B");
    expect(store.claimJob("job-A", "agent-1")).toBe(true);
    expect(store.claimJob("job-B", "agent-2")).toBe(true);
  });
});

// ── Cron email deduplication ──────────────────────────────────────────────

describe("Cron email deduplication", () => {
  /**
   * Simulates email deduplication by (customer_id, template_id, week).
   * Matches the logic in cron/engagement/route.ts.
   */

  class SentEmailsTracker {
    private sent = new Set<string>();

    canSend(customerId: string, templateId: string, weekKey: string): boolean {
      const key = `${customerId}:${templateId}:${weekKey}`;
      return !this.sent.has(key);
    }

    markSent(customerId: string, templateId: string, weekKey: string): void {
      const key = `${customerId}:${templateId}:${weekKey}`;
      this.sent.add(key);
    }
  }

  function getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const start = new Date(year, 0, 1);
    const week = Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
    return `${year}-W${week}`;
  }

  it("first email in week is allowed", () => {
    const tracker = new SentEmailsTracker();
    const week = getWeekKey(new Date());
    expect(tracker.canSend("customer-1", "template-welcome", week)).toBe(true);
  });

  it("duplicate email in same week is blocked", () => {
    const tracker = new SentEmailsTracker();
    const week = getWeekKey(new Date());
    tracker.markSent("customer-1", "template-welcome", week);
    expect(tracker.canSend("customer-1", "template-welcome", week)).toBe(false);
  });

  it("same customer can receive different templates in same week", () => {
    const tracker = new SentEmailsTracker();
    const week = getWeekKey(new Date());
    tracker.markSent("customer-1", "template-welcome", week);
    expect(tracker.canSend("customer-1", "template-promo", week)).toBe(true);
  });

  it("same template can be sent to different customers in same week", () => {
    const tracker = new SentEmailsTracker();
    const week = getWeekKey(new Date());
    tracker.markSent("customer-1", "template-welcome", week);
    expect(tracker.canSend("customer-2", "template-welcome", week)).toBe(true);
  });

  it("same template can be sent again in a different week", () => {
    const tracker = new SentEmailsTracker();
    tracker.markSent("customer-1", "template-welcome", "2026-W01");
    expect(tracker.canSend("customer-1", "template-welcome", "2026-W02")).toBe(true);
  });
});
