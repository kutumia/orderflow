import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";

/**
 * POST /api/orders/refund
 * Body: { order_id, reason }
 * Processes a full refund via Stripe, updates order status, emails customer.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();
  const { order_id, reason } = body;

  if (!order_id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  // Fetch the order
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, restaurants(name)")
    .eq("id", order_id)
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "Order already refunded" }, { status: 400 });
  }

  if (!order.stripe_payment_intent_id) {
    return NextResponse.json({ error: "No payment found for this order" }, { status: 400 });
  }

  try {
    // Process Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      reason: "requested_by_customer",
    });

    // Update order
    await supabaseAdmin
      .from("orders")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        refund_reason: reason || "Refund requested by restaurant",
        stripe_refund_id: refund.id,
      })
      .eq("id", order_id);

    // Send refund email to customer
    const restaurant = order.restaurants as any;
    const fp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

    await sendEmail({
      to: order.customer_email,
      subject: `Refund processed — Order #${order.order_number}`,
      html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f5f5f5">
<div style="max-width:500px;margin:0 auto;padding:20px">
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:#1B4F72;padding:24px;text-align:center">
  <h1 style="color:white;margin:0;font-size:20px">Refund Processed</h1>
</div>
<div style="padding:24px">
  <p style="margin:0 0 12px;color:#666;font-size:14px">Hi ${escapeHtml(order.customer_name)},</p>
  <p style="margin:0 0 20px;color:#666;font-size:14px">
    Your refund of <strong>${fp(order.total)}</strong> for order #${order.order_number}
    from <strong>${escapeHtml(restaurant?.name || "")}</strong> has been processed.
  </p>
  <p style="margin:0;color:#666;font-size:14px">
    The refund will appear on your statement within 5-10 business days.
  </p>
  ${reason ? `<p style="margin:16px 0 0;color:#999;font-size:13px">Reason: ${escapeHtml(reason)}</p>` : ""}
</div>
<div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:12px;color:#999">
  Powered by OrderFlow
</div>
</div></div></body></html>`,
    });

    return NextResponse.json({
      success: true,
      refund_id: refund.id,
      amount: refund.amount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Refund failed: ${err.message}` },
      { status: 500 }
    );
  }
}
