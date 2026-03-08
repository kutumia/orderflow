import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/onboarding-progress
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  // Count menu items
  const { count: menuItems } = await supabaseAdmin
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  // Count opening hours set
  const { count: hoursSet } = await supabaseAdmin
    .from("opening_hours")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("is_closed", false);

  // Check Stripe connected
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("stripe_account_id")
    .eq("id", restaurantId)
    .single();

  return NextResponse.json({
    menu_items: menuItems || 0,
    hours_set: hoursSet || 0,
    stripe_connected: !!restaurant?.stripe_account_id,
  });
}
