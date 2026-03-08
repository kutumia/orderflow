import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/orders/status?id=xxx&token=yyy
 *
 * [P2 FIX] Previously unauthenticated — any order UUID leaked (e.g. in a
 * support conversation or server log) exposed customer name, phone, delivery
 * address, and full item list. Now requires customer_token, the random 32-char
 * hex secret returned by /api/checkout and stored on the order. The status
 * page URL must include both the order ID and the token.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  if (!id || !token) {
    return NextResponse.json({ error: "Order ID and token required" }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, order_type, total, created_at, items, customer_name, customer_token, restaurants(name, estimated_delivery_mins, estimated_collection_mins)")
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.customer_token !== token) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Strip customer_token from the response — it stays server-side only.
  const { customer_token: _omit, ...safeOrder } = order;
  return NextResponse.json(safeOrder);
}
