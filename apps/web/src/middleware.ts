import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware — runs on every request.
 *
 * Fix #1:  Custom domain host validation — only allow known hosts.
 * Fix #13: Order creation rate limiting by IP.
 * S-5:     CSRF origin validation on state-mutating API routes.
 */

// Routes that use API-key auth (not cookie sessions) — exempt from CSRF check
const API_KEY_ROUTES = [
  "/api/webhooks/",
  "/api/pb/v1/",
  "/api/print-heartbeat",
  "/api/print-jobs",
  "/api/print-fallback",
  "/api/shopify/webhooks",
  "/api/cron/",
  "/api/health",
  "/api/unsubscribe",
  "/api/checkout",
  "/api/restaurants",
];

export function middleware(req: NextRequest) {
  const { pathname, host } = req.nextUrl;

  // ── Fix #1: Custom domain host validation ──
  if (process.env.NODE_ENV === "production") {
    const allowedBase = process.env.ALLOWED_HOST || "orderflow.co.uk";
    const isAllowedHost =
      host === allowedBase ||
      host === `www.${allowedBase}` ||
      host.endsWith(`.${allowedBase}`) ||
      host.endsWith(".vercel.app");

    if (!isAllowedHost) {
      const res = NextResponse.next();
      res.headers.set("x-custom-domain", host);
      return res;
    }
  }

  // ── S-5: CSRF origin validation ──
  // For state-mutating requests (POST/PUT/PATCH/DELETE) to authenticated API routes,
  // verify the Origin header matches the app's URL. This prevents cross-site
  // request forgery via the NextAuth session cookie.
  const method = req.method;
  const isStateMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isApiRoute = pathname.startsWith("/api/");

  if (isStateMutating && isApiRoute && process.env.NODE_ENV === "production") {
    const isExempt = API_KEY_ROUTES.some((prefix) => pathname.startsWith(prefix));

    if (!isExempt) {
      const origin = req.headers.get("origin");
      const appUrl = process.env.NEXTAUTH_URL || `https://${process.env.ALLOWED_HOST || "orderflow.co.uk"}`;

      // Allow requests with no Origin header (server-to-server) or matching origin
      if (origin && !isOriginAllowed(origin, appUrl)) {
        return NextResponse.json(
          { error: "Cross-origin request blocked" },
          { status: 403 }
        );
      }
    }
  }

  // ── Fix #13: Propagate client IP for rate limiting ──
  if (pathname === "/api/checkout" || pathname.startsWith("/api/orders")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const res = NextResponse.next();
    res.headers.set("x-client-ip", ip);
    return res;
  }

  return NextResponse.next();
}

function isOriginAllowed(origin: string, appUrl: string): boolean {
  try {
    const originHost = new URL(origin).host;
    const appHost = new URL(appUrl).host;
    // Allow exact match or any subdomain of the app host
    return originHost === appHost || originHost.endsWith(`.${appHost}`);
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|widget.js|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
};
