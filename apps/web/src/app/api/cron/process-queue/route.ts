import { NextRequest, NextResponse } from "next/server";
import { processQueueBatch } from "@/lib/queue";
import { log } from "@/lib/logger";
import crypto from "crypto";

/**
 * GET /api/cron/process-queue
 *
 * Vercel Cron job (runs every minute). Drains the background job queue
 * (email sends, etc.) that were enqueued by API routes.
 *
 * Add to vercel.json:
 * { "path": "/api/cron/process-queue", "schedule": "* * * * *" }
 *
 * Protected by CRON_SECRET env var.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = authHeader.replace(/^Bearer\s+/i, "");
  // Use timing-safe comparison to prevent brute-force via timing side-channel
  if (
    !cronSecret ||
    secret.length !== cronSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(cronSecret))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Process up to 20 jobs per invocation (stays well under Vercel's 10s limit)
    const processed = await processQueueBatch(20);
    log.info("Queue batch processed", { processed });
    return NextResponse.json({ processed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("Queue processing error", { error: message });
    return NextResponse.json({ error: "Queue processing failed" }, { status: 500 });
  }
}
