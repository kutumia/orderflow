import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/shopify/orders
 * Syncs an OrderFlow order to Shopify as a draft order.
 * Called internally when an order is completed for a Shopify-linked restaurant.
 *
 * Body: { order_id, shop }
 */
export async function POST(req: NextRequest) {
  const { order_id, shop } = await req.json();

  if (!order_id || !shop) {
    return NextResponse.json({ error: "order_id and shop required" }, { status: 400 });
  }

  // Get shop credentials
  const { data: shopData } = await supabaseAdmin
    .from("shopify_shops")
    .select("access_token")
    .eq("shop", shop)
    .eq("is_active", true)
    .single();

  if (!shopData?.access_token) {
    return NextResponse.json({ error: "Shop not found or not active" }, { status: 404 });
  }

  // Get order details
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", order_id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Build Shopify draft order
  const lineItems = (order.items || []).map((item: any) => ({
    title: item.name,
    price: (item.price / 100).toFixed(2),
    quantity: item.quantity,
    requires_shipping: order.order_type === "delivery",
  }));

  // Add delivery fee as line item if applicable
  if (order.delivery_fee && order.delivery_fee > 0) {
    lineItems.push({
      title: "Delivery Fee",
      price: (order.delivery_fee / 100).toFixed(2),
      quantity: 1,
      requires_shipping: false,
    });
  }

  const draftOrder = {
    draft_order: {
      line_items: lineItems,
      customer: {
        first_name: order.customer_name?.split(" ")[0] || "Customer",
        last_name: order.customer_name?.split(" ").slice(1).join(" ") || "",
        email: order.customer_email || undefined,
      },
      note: `OrderFlow #${order.order_number} — ${order.order_type}${order.table_number ? ` (Table ${order.table_number})` : ""}`,
      tags: "orderflow,synced",
      shipping_address: order.order_type === "delivery" && order.delivery_address ? {
        address1: order.delivery_address,
      } : undefined,
      use_customer_default_address: false,
      tax_exempt: false,
    },
  };

  // Create draft order in Shopify
  try {
    const res = await fetch(`https://${shop}/admin/api/2024-07/draft_orders.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": shopData.access_token,
      },
      body: JSON.stringify(draftOrder),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: "Shopify API error", details: errBody }, { status: res.status });
    }

    const result = await res.json();
    const shopifyDraftId = result.draft_order?.id;

    // Store sync record
    await supabaseAdmin
      .from("orders")
      .update({ shopify_draft_order_id: shopifyDraftId?.toString() })
      .eq("id", order_id);

    return NextResponse.json({
      success: true,
      shopify_draft_order_id: shopifyDraftId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 });
  }
}

/**
 * GET /api/shopify/orders?shop=xxx&limit=20
 * List recently synced orders for a shop.
 */
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "shop required" }, { status: 400 });

  const { data: shopData } = await supabaseAdmin
    .from("shopify_shops")
    .select("restaurant_slug")
    .eq("shop", shop)
    .single();

  if (!shopData?.restaurant_slug) {
    return NextResponse.json({ orders: [] });
  }

  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("slug", shopData.restaurant_slug)
    .single();

  if (!restaurant) return NextResponse.json({ orders: [] });

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, status, shopify_draft_order_id, created_at")
    .eq("restaurant_id", restaurant.id)
    .not("shopify_draft_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ orders: orders || [] });
}
