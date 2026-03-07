/**
 * PrintBridge API auth — shared by all /api/pb/v1/* endpoints.
 * Resolves tenant from X-API-Key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveTenantByKey, type TenantInfo } from "@/lib/printbridge";

export type AuthResult =
  | { ok: true; tenant: TenantInfo }
  | { ok: false; response: NextResponse };

/**
 * Authenticate a PB API request.
 * Returns tenant info on success, or a 401/429 response on failure.
 */
export async function authenticatePB(req: NextRequest): Promise<AuthResult> {
  // Support both header and query param (for agent backwards compat)
  const apiKey =
    req.headers.get("X-API-Key") ||
    req.headers.get("x-api-key") ||
    new URL(req.url).searchParams.get("api_key");

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing API key. Pass via X-API-Key header." },
        { status: 401 }
      ),
    };
  }

  const tenant = await resolveTenantByKey(apiKey);
  if (!tenant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid API key." },
        { status: 401 }
      ),
    };
  }

  // Rate limit check (0 = unlimited)
  if (tenant.monthly_limit > 0 && tenant.usage_count >= tenant.monthly_limit) {
    const res = NextResponse.json(
      {
        error: "Monthly job limit exceeded.",
        limit: tenant.monthly_limit,
        usage: tenant.usage_count,
        resets_at: tenant.usage_reset_at,
      },
      { status: 429 }
    );
    res.headers.set("Retry-After", "86400");
    return { ok: false, response: res };
  }

  return { ok: true, tenant };
}
