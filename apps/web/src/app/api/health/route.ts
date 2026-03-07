import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/health
 * Health check endpoint for uptime monitoring.
 * Returns: { status, db, timestamp, version }
 */
export async function GET() {
  const start = Date.now();
  let dbStatus = "unknown";

  try {
    // Test database connectivity
    const { error } = await supabaseAdmin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .limit(1);

    dbStatus = error ? "error" : "ok";
  } catch {
    dbStatus = "error";
  }

  const latency = Date.now() - start;

  const response = {
    status: dbStatus === "ok" ? "healthy" : "degraded",
    db: dbStatus,
    latency_ms: latency,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    env: process.env.VERCEL_ENV || "development",
  };

  return NextResponse.json(response, {
    status: dbStatus === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store",
    },
  });
}
