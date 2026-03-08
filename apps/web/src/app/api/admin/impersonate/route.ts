import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/logger";
import crypto from "crypto";

const SESSION_COOKIE = "of_impersonate";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * POST /api/admin/impersonate
 * Body: { restaurant_id } — start impersonation
 * Body: { action: "exit" }  — end impersonation
 *
 * Impersonation state is stored server-side in admin_impersonation_sessions.
 * The client receives only an opaque session token via HttpOnly cookie.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const body = await req.json();
  const { restaurant_id, action } = body;

  // ── Exit impersonation ──
  if (action === "exit") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      await supabaseAdmin
        .from("admin_impersonation_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("token", token)
        .is("ended_at", null);
    }

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action: "exit_impersonation",
      target_restaurant_id: restaurant_id || null,
      ip_address: ip,
    });

    log.info("Admin exited impersonation", { adminId: user.id, ip });

    const res = NextResponse.json({ success: true, impersonating: null });
    // Clear the cookie
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  if (!restaurant_id) {
    return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });
  }

  // Fetch restaurant
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug, subscription_status, trial_ends_at, plan")
    .eq("id", restaurant_id)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  // Create server-side session record
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await supabaseAdmin.from("admin_impersonation_sessions").insert({
    token: sessionToken,
    admin_user_id: user.id,
    target_restaurant_id: restaurant.id,
    expires_at: expiresAt,
    ip_address: ip,
  });

  await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: user.id,
    action: "start_impersonation",
    target_restaurant_id: restaurant_id,
    details: { restaurant_name: restaurant.name },
    ip_address: ip,
  });

  log.info("Admin started impersonation", {
    adminId: user.id,
    restaurantId: restaurant.id,
    ip,
  });

  const res = NextResponse.json({
    success: true,
    impersonating: {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      restaurant_slug: restaurant.slug,
    },
  });

  // Set opaque session token as HttpOnly cookie — never exposes restaurant data to JS
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return res;
}

/**
 * GET /api/admin/impersonate
 * Returns the current impersonation session (validated server-side).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ impersonating: null });
  }

  const { data: impSession } = await supabaseAdmin
    .from("admin_impersonation_sessions")
    .select("target_restaurant_id, expires_at, restaurants(id, name, slug, subscription_status)")
    .eq("token", token)
    .eq("admin_user_id", user.id)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!impSession) {
    // Token expired or invalid — clear the cookie
    const res = NextResponse.json({ impersonating: null });
    res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  const r = impSession.restaurants as any;
  return NextResponse.json({
    impersonating: {
      restaurant_id: impSession.target_restaurant_id,
      restaurant_name: r?.name,
      restaurant_slug: r?.slug,
      subscription_status: r?.subscription_status,
    },
  });
}
