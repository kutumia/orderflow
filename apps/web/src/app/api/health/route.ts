import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/health
 * E4-T06 — Comprehensive health check endpoint.
 *
 * Checks:
 *   - Database connectivity and query latency
 *   - Environment completeness (critical vars present)
 *   - Service version and deployment info
 *
 * Returns 200 when healthy, 503 when degraded.
 * Used by: Vercel uptime checks, load balancers, monitoring dashboards.
 */

interface HealthCheck {
  status: "ok" | "error" | "degraded";
  latency_ms?: number;
  error?: string;
  missing?: string[];
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: HealthCheck;
    environment: HealthCheck;
  };
  version: string;
  timestamp: string;
  env: string;
  uptime_s?: number;
}

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXTAUTH_SECRET",
  "STRIPE_SECRET_KEY",
];

const startTime = Date.now();

export async function GET() {
  const dbCheck = await checkDatabase();
  const envCheck = checkEnvironment();

  const allOk = dbCheck.status === "ok" && envCheck.status === "ok";
  const anyError = dbCheck.status === "error" || envCheck.status === "error";

  const overallStatus: HealthResponse["status"] = allOk
    ? "healthy"
    : anyError
    ? "unhealthy"
    : "degraded";

  const response: HealthResponse = {
    status: overallStatus,
    checks: {
      database: dbCheck,
      environment: envCheck,
    },
    version:
      process.env.npm_package_version ??
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
      "unknown",
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    uptime_s: Math.floor((Date.now() - startTime) / 1000),
  };

  return NextResponse.json(response, {
    status: overallStatus === "healthy" ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Health-Status": overallStatus,
    },
  });
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { error } = await supabaseAdmin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .limit(1);

    const latency_ms = Date.now() - start;

    if (error) {
      return { status: "error", latency_ms, error: "Database query failed" };
    }

    if (latency_ms > 2000) {
      return { status: "degraded", latency_ms };
    }

    return { status: "ok", latency_ms };
  } catch {
    return {
      status: "error",
      latency_ms: Date.now() - start,
      error: "Database unreachable",
    };
  }
}

function checkEnvironment(): HealthCheck {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    return { status: "error", missing };
  }
  return { status: "ok" };
}
