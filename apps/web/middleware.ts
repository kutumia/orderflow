import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATED_PATHS, hasFeature, requiredPlan } from "@/lib/feature-gates";
import type { Feature } from "@/lib/feature-gates";

// Pages that only owners/admins can access
const OWNER_ONLY_PATHS = [
  "/dashboard/settings",
  "/dashboard/billing",
  "/dashboard/customers",
  "/dashboard/promotions",
  "/dashboard/reports",
  "/dashboard/staff",
  "/dashboard/loyalty",
  "/dashboard/marketing",
  "/dashboard/qr-code",
];

/**
 * Custom domain handling — runs BEFORE auth middleware.
 * If the request Host matches a restaurant's custom_domain,
 * rewrite to that restaurant's ordering page.
 */
export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const path = req.nextUrl.pathname;

  // Skip custom domain logic for dashboard, admin, API, and static files
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path === "/favicon.ico"
  ) {
    return authMiddleware(req as any);
  }

  // Check if this is a custom domain (not our main domain)
  const mainDomains = [
    "localhost:3000",
    "orderflow.co.uk",
    "www.orderflow.co.uk",
    process.env.VERCEL_URL,
  ].filter(Boolean);

  if (!mainDomains.some((d) => host.includes(d!))) {
    // This might be a custom domain — rewrite to the restaurant's page
    // The ordering page will look up the restaurant by custom_domain
    const url = req.nextUrl.clone();
    url.pathname = `/_custom-domain${path}`;
    url.searchParams.set("custom_domain", host.split(":")[0]);
    return NextResponse.rewrite(url);
  }

  // For auth-protected routes, use NextAuth middleware
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    return authMiddleware(req as any);
  }

  return NextResponse.next();
}

// Auth middleware for dashboard/admin routes
const authMiddleware = withAuth(
  function handler(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Trial expiry enforcement (BUG-014)
    if (
      path.startsWith("/dashboard") &&
      path !== "/dashboard/billing" &&
      token?.subscription_status === "trialing" &&
      token?.trial_ends_at
    ) {
      const trialEnd = new Date(token.trial_ends_at as string);
      if (trialEnd < new Date()) {
        return NextResponse.redirect(new URL("/dashboard/billing?expired=true", req.url));
      }
    }

    // Subscription cancelled — redirect to billing
    if (
      path.startsWith("/dashboard") &&
      path !== "/dashboard/billing" &&
      token?.subscription_status === "cancelled"
    ) {
      return NextResponse.redirect(new URL("/dashboard/billing?suspended=true", req.url));
    }

    // Feature gating — check plan access
    for (const [gatedPath, feature] of Object.entries(GATED_PATHS)) {
      if (path.startsWith(gatedPath)) {
        const plan = (token?.plan as string) || "starter";
        if (!hasFeature(plan, feature as Feature)) {
          const needed = requiredPlan(feature as Feature);
          return NextResponse.redirect(
            new URL(`/dashboard/billing?upgrade=true&feature=${feature}&plan=${needed}`, req.url)
          );
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        if (path.startsWith("/dashboard")) {
          if (!token) return false;

          if (OWNER_ONLY_PATHS.some((p) => path.startsWith(p))) {
            return token.role === "owner" || token.role === "admin";
          }
          return true;
        }

        if (path.startsWith("/admin")) {
          return token?.role === "admin";
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    // Custom domain catch-all (skip static files)
    "/((?!_next|api|favicon.ico).*)",
  ],
};
