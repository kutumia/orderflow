import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/orders/export?from=2026-01-01&to=2026-01-31
 * Downloads CSV file of orders for the given date range.
 */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);

  const { data: orders, error } = await query.limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = [
    "Order Number", "Date", "Time", "Customer Name", "Customer Email",
    "Customer Phone", "Order Type", "Items", "Subtotal", "Delivery Fee",
    "Discount", "VAT", "Total", "Status", "Payment Status",
  ];

  const csvRows = [headers.join(",")];
  for (const o of orders || []) {
    const dt = new Date(o.created_at);
    const date = dt.toLocaleDateString("en-GB");
    const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const items = (o.items || [])
      .map((i: any) => `${i.quantity}x ${i.name}`)
      .join("; ");

    const row = [
      o.order_number,
      date,
      time,
      csvEscape(o.customer_name || ""),
      csvEscape(o.customer_email || ""),
      csvEscape(o.customer_phone || ""),
      o.order_type,
      csvEscape(items),
      toPounds(o.subtotal),
      toPounds(o.delivery_fee),
      toPounds(o.discount),
      toPounds(o.vat_amount || 0),
      toPounds(o.total),
      o.status,
      o.stripe_payment_intent_id ? "paid" : "unpaid",
    ];
    csvRows.push(row.join(","));
  }

  const csv = csvRows.join("\n");
  const filename = `orders-${from || "all"}-to-${to || "now"}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function toPounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

function csvEscape(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
