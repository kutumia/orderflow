import { NextRequest, NextResponse } from "next/server";
import { processQueueBatch } from "@/lib/queue";
import { log } from "@/lib/logger";

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
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Process up to 20 jobs per invocation (stays well under Vercel's 10s limit)
    const processed = await processQueueBatch(20);
    log.info("Queue batch processed", { processed });
    return NextResponse.json({ processed });
  } catch (err: any) {
    log.error("Queue processing error", { error: err.message });
    return NextResponse.json({ error: "Queue processing failed" }, { status: 500 });
  }
}
