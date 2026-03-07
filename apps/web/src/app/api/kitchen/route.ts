import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/kitchen?slug=xxx — fetch active orders for kitchen display
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  let restaurantId: string | null = null;

  // Auth method 1: Session (dashboard kitchen page)
  const session = await getServerSession(authOptions);
  if (session) {
    restaurantId = (session.user as any).restaurant_id;
  }

  // Auth method 2: Slug (dedicated kitchen screen)
  if (!restaurantId && slug) {
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (restaurant) restaurantId = restaurant.id;
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch active orders (confirmed, preparing, ready, out_for_delivery)
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, order_type, customer_name, customer_phone, delivery_address, items, notes, total, created_at")
    .eq("restaurant_id", restaurantId)
    .in("status", ["confirmed", "preparing", "ready", "out_for_delivery"])
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PUT /api/kitchen — update order status from kitchen display
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { order_id, status, slug } = body;

  if (!order_id || !status) {
    return NextResponse.json({ error: "Order ID and status required" }, { status: 400 });
  }

  let restaurantId: string | null = null;

  const session = await getServerSession(authOptions);
  if (session) {
    restaurantId = (session.user as any).restaurant_id;
  }

  if (!restaurantId && slug) {
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    if (restaurant) restaurantId = restaurant.id;
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validStatuses = [
    "confirmed", "preparing", "ready", "out_for_delivery",
    "delivered", "collected",
  ];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status })
    .eq("id", order_id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log status history
  await supabaseAdmin.from("order_status_history").insert({
    order_id,
    status,
    changed_by: session ? (session.user as any).id : null,
  });

  return NextResponse.json({ success: true });
}
