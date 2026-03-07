import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/admin/impersonate — start impersonating a restaurant
 * Body: { restaurant_id }
 * Returns a temporary token with the impersonated restaurant's data.
 *
 * GET /api/admin/impersonate — get current impersonation status
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { restaurant_id, action } = body;

  // Exit impersonation
  if (action === "exit") {
    // Log the exit
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action: "exit_impersonation",
      target_restaurant_id: restaurant_id || null,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
    });

    return NextResponse.json({ success: true, impersonating: null });
  }

  if (!restaurant_id) {
    return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });
  }

  // Fetch restaurant
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug, subscription_status, trial_ends_at")
    .eq("id", restaurant_id)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  // Log the impersonation
  await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: user.id,
    action: "start_impersonation",
    target_restaurant_id: restaurant_id,
    details: { restaurant_name: restaurant.name },
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
  });

  // Return impersonation data (client stores in sessionStorage)
  return NextResponse.json({
    success: true,
    impersonating: {
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      restaurant_slug: restaurant.slug,
      subscription_status: restaurant.subscription_status,
      trial_ends_at: restaurant.trial_ends_at,
    },
  });
}
