import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/onboarding-progress
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;

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
