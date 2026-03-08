import { NextResponse } from "next/server";

/**
 * REMOVED: /api/print-heartbeat
 *
 * This endpoint has been permanently removed. Use the PrintBridge v1 API instead:
 *   POST /api/pb/v1/heartbeat
 *   GET  /api/pb/v1/heartbeat
 *
 * Returns 410 Gone so that outdated PrintBridge agent versions surface a clear
 * upgrade prompt rather than silently failing or receiving unexpected errors.
 *
 * A-2: 410 replaces the old implementation — no DB queries, no rate limit,
 * no dead code paths. Cache-Control lets CDN/proxies serve this cheaply.
 */

const gone = () =>
  NextResponse.json(
    {
      error:
        "This endpoint has been removed. Update your PrintBridge agent and use /api/pb/v1/heartbeat.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "public, max-age=86400" },
    }
  );

export function GET() {
  return gone();
}

export function POST() {
  return gone();
}
