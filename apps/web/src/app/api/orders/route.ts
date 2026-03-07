import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { refundPayment } from "@/lib/stripe";

// GET /api/orders?filter=live|today|all&page=1&limit=50&from=&to=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "live";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("orders")
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (filter === "live") {
    query = query.in("status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"]);
  } else if (filter === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query = query.gte("created_at", todayStart.toISOString());
  } else {
    // "all" — apply pagination and optional date range
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    orders: data || [],
    total: count || 0,
    page,
    limit,
    pages: Math.ceil((count || 0) / limit),
  });
}

// PUT /api/orders — update order status
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const userId = (session.user as any).id;
  const body = await req.json();

  const { order_id, status, refund_reason } = body;

  if (!order_id || !status) {
    return NextResponse.json({ error: "Order ID and status required" }, { status: 400 });
  }

  const validStatuses = [
    "confirmed", "preparing", "ready", "out_for_delivery",
    "delivered", "collected", "cancelled", "refunded",
  ];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Fetch order
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status, stripe_payment_intent_id")
    .eq("id", order_id)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Handle refund
  if (status === "refunded" && order.stripe_payment_intent_id) {
    try {
      await refundPayment(order.stripe_payment_intent_id, refund_reason);
    } catch (err: any) {
      return NextResponse.json({ error: `Refund failed: ${err.message}` }, { status: 500 });
    }
  }

  // Update order
  const updateData: any = { status };
  if (status === "refunded") {
    updateData.refunded_at = new Date().toISOString();
    updateData.refund_reason = refund_reason || null;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update(updateData)
    .eq("id", order_id)
    .eq("restaurant_id", restaurantId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Log status change
  await supabaseAdmin.from("order_status_history").insert({
    order_id,
    status,
    changed_by: userId,
  });

  return NextResponse.json({ success: true });
}
