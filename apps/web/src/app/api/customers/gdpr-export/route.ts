import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/customers/gdpr-export?customer_id=xxx
 * Returns all stored data for a customer as a JSON file download.
 */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customer_id");

  if (!customerId) {
    return NextResponse.json({ error: "Customer ID required" }, { status: 400 });
  }

  // Fetch customer record
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Fetch all orders for this customer (by email match)
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, created_at, status, order_type, items, subtotal, delivery_fee, discount, total, vat_amount, notes, delivery_address")
    .eq("restaurant_id", restaurantId)
    .eq("customer_email", customer.email)
    .order("created_at", { ascending: false })
    .limit(1000);

  const exportData = {
    export_date: new Date().toISOString(),
    export_type: "GDPR Data Subject Access Request",
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      first_order: customer.first_order_at,
      last_order: customer.last_order_at,
      total_orders: customer.order_count,
      total_spent: customer.total_spent,
      created_at: customer.created_at,
    },
    orders: (orders || []).map((o) => ({
      order_number: o.order_number,
      date: o.created_at,
      status: o.status,
      type: o.order_type,
      items: o.items,
      subtotal: o.subtotal,
      delivery_fee: o.delivery_fee,
      discount: o.discount,
      vat: o.vat_amount,
      total: o.total,
      notes: o.notes,
      delivery_address: o.delivery_address,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);
  const filename = `customer-data-${customer.email.replace(/[^a-z0-9]/gi, "-")}.json`;

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
