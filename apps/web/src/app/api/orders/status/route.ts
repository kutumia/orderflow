import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/orders/status?id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, order_type, total, created_at, items, customer_name, restaurants(name, estimated_delivery_mins, estimated_collection_mins)")
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}
