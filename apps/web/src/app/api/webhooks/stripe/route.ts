import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail, orderConfirmationEmail } from "@/lib/email";
import { formatPlainTextReceipt, type ReceiptOrder } from "@/lib/receipt";
import { log } from "@/lib/logger";
import { enqueueJob } from "@/lib/queue";
import { createJob, resolveTenantByRestaurant } from "@/lib/printbridge";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    log.error("Webhook signature verification failed", { error: err.message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  log.info("Webhook received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as any);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as any);
        break;

      // ── Subscription lifecycle (BUG-003) ──
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as any);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as any);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as any);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as any);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object as any);
        break;

      default:
        log.debug("Unhandled webhook event", { type: event.type });
    }
  } catch (err: any) {
    log.error("Webhook handler error", { type: event.type, error: err.message, stack: err.stack });
    // Still return 200 so Stripe doesn't retry endlessly for application errors
  }

  return NextResponse.json({ received: true });
}

// ──────────────────────────────────────
// Payment Intent Succeeded — Confirm Order
// ──────────────────────────────────────
async function handlePaymentSucceeded(pi: any) {
  const paymentIntentId = pi.id;

  // Find the order
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("*, restaurants(name, email, estimated_delivery_mins, estimated_collection_mins)")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();

  if (oErr || !order) {
    log.warn("Order not found for payment intent", { paymentIntentId });
    return;
  }

  // Idempotency: skip if already confirmed
  if (order.status !== "pending") {
    log.info("Order already processed, skipping", { orderId: order.id, status: order.status });
    return;
  }

  // Update order status atomically (the status check in WHERE prevents race conditions)
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "confirmed" })
    .eq("id", order.id)
    .eq("status", "pending") // Only update if still pending
    .select("id")
    .single();

  if (updateErr || !updated) {
    log.info("Order status already changed (concurrent webhook)", { orderId: order.id });
    return;
  }

  // Add status history
  await supabaseAdmin.from("order_status_history").insert({
    order_id: order.id,
    status: "confirmed",
  });

  // Upsert customer record
  await upsertCustomer(order);

  // Atomic promo code increment (BUG-020)
  if (order.promo_code_used) {
    const { data: promo } = await supabaseAdmin
      .from("promo_codes")
      .select("id")
      .eq("restaurant_id", order.restaurant_id)
      .eq("code", order.promo_code_used)
      .single();

    if (promo) {
      await supabaseAdmin.rpc("increment_promo_usage", { promo_uuid: promo.id });
    }
  }

  // Create print job WITH receipt data (BUG-018)
  const restaurant = order.restaurants as any;
  const receiptData: ReceiptOrder = {
    order_number: order.order_number,
    order_type: order.order_type,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    delivery_address: order.delivery_address,
    notes: order.notes,
    items: order.items || [],
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    discount: order.discount,
    total: order.total,
    promo_code_used: order.promo_code_used,
    created_at: order.created_at,
    restaurant_name: restaurant?.name || "Restaurant",
  };

  // Enqueue print jobs via PrintBridge SDK
  const { data: devices } = await supabaseAdmin
    .from("printer_devices")
    .select("id, assigned_categories, is_default")
    .eq("restaurant_id", order.restaurant_id);

  const receiptText = formatPlainTextReceipt(receiptData);

  // Resolve tenant for this restaurant
  const tenant = await resolveTenantByRestaurant(order.restaurant_id);
  const tenantId = tenant?.id || "";

  if (tenantId && devices && devices.length > 1) {
    // Multi-device: route items to devices by category
    const itemCategoryIds = (order.items || []).map((i: any) => i.category_id).filter(Boolean);
    const assignedDevices = devices.filter((d) => d.assigned_categories?.length > 0);
    const defaultDevice = devices.find((d) => d.is_default) || devices[0];

    if (assignedDevices.length > 0) {
      const targetDeviceIds = new Set<string>();
      for (const catId of itemCategoryIds) {
        const match = assignedDevices.find((d) => d.assigned_categories.includes(catId));
        if (match) targetDeviceIds.add(match.id);
      }
      if (targetDeviceIds.size === 0) targetDeviceIds.add(defaultDevice.id);

      for (const deviceId of targetDeviceIds) {
        await enqueueJob("print_receipt", {
          tenantId,
          restaurantId: order.restaurant_id,
          orderId: order.id,
          deviceId,
          receiptData: receiptText,
          priority: 1,
        });
      }
    } else {
      await enqueueJob("print_receipt", {
        tenantId,
        restaurantId: order.restaurant_id,
        orderId: order.id,
        deviceId: defaultDevice.id,
        receiptData: receiptText,
        priority: 1,
      });
    }
  } else if (tenantId) {
    await enqueueJob("print_receipt", {
      tenantId,
      restaurantId: order.restaurant_id,
      orderId: order.id,
      deviceId: devices?.[0]?.id || undefined,
      receiptData: receiptText,
      priority: 1,
    });
  }

  // Send confirmation email to customer
  const estimatedMins =
    order.order_type === "delivery"
      ? restaurant?.estimated_delivery_mins || 45
      : restaurant?.estimated_collection_mins || 20;

  const emailContent = orderConfirmationEmail({
    order_number: order.order_number,
    customer_name: order.customer_name,
    restaurant_name: restaurant?.name || "Restaurant",
    items: order.items,
    subtotal: order.subtotal,
    delivery_fee: order.delivery_fee,
    discount: order.discount,
    total: order.total,
    order_type: order.order_type,
    estimated_mins: estimatedMins,
  });

  await enqueueJob("email", {
    to: order.customer_email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  // Earn loyalty stamps/points (direct call, not HTTP)
  try {
    const { data: program } = await supabaseAdmin
      .from("loyalty_programs")
      .select("*")
      .eq("restaurant_id", order.restaurant_id)
      .eq("is_active", true)
      .single();

    if (program && order.customer_email) {
      let { data: card } = await supabaseAdmin
        .from("loyalty_cards")
        .select("*")
        .eq("restaurant_id", order.restaurant_id)
        .eq("customer_email", order.customer_email.toLowerCase())
        .single();

      if (!card) {
        const { data: newCard } = await supabaseAdmin
          .from("loyalty_cards")
          .insert({ restaurant_id: order.restaurant_id, customer_email: order.customer_email.toLowerCase() })
          .select()
          .single();
        card = newCard;
      }

      if (card) {
        const updates: any = { last_earn_at: new Date().toISOString() };
        if (program.type === "stamps") {
          updates.stamps_earned = (card.stamps_earned || 0) + 1;
        } else {
          updates.points_balance = (card.points_balance || 0) + Math.floor((order.total / 100) * (program.points_per_pound || 1));
        }
        await supabaseAdmin.from("loyalty_cards").update(updates).eq("id", card.id);
      }
    }
  } catch {
    // Loyalty earn is non-critical
  }

  // Notify restaurant by email
  if (restaurant?.email) {
    const fp = (p: number) => `£${(p / 100).toFixed(2)}`;
    await enqueueJob("email", {
      to: restaurant.email,
      subject: `New Order #${order.order_number} — ${fp(order.total)}`,
      html: `<div style="font-family:sans-serif;padding:20px">
        <h2>New ${order.order_type} order!</h2>
        <p><strong>Order #${order.order_number}</strong> from ${order.customer_name}</p>
        <p style="font-size:24px;font-weight:bold;color:#2E86C1">${fp(order.total)}</p>
        <p>Log in to your dashboard to manage this order.</p>
      </div>`,
    });
  }

  log.info("Order confirmed", { orderId: order.id, orderNumber: order.order_number });
}

// ──────────────────────────────────────
// Payment Failed — Cancel Order
// ──────────────────────────────────────
async function handlePaymentFailed(pi: any) {
  log.warn("Payment failed", { paymentIntentId: pi.id, error: pi.last_payment_error?.message });

  await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("stripe_payment_intent_id", pi.id)
    .eq("status", "pending");
}

// ──────────────────────────────────────
// Invoice Paid — Subscription renewed (BUG-003)
// ──────────────────────────────────────
async function handleInvoicePaid(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Find the subscription
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, restaurant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!sub) {
    log.warn("Subscription not found for invoice.paid", { subscriptionId });
    return;
  }

  // Clear past_due status
  await supabaseAdmin
    .from("restaurants")
    .update({ subscription_status: "active" })
    .eq("id", sub.restaurant_id);

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: invoice.lines?.data?.[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
        : null,
    })
    .eq("id", sub.id);

  log.info("Subscription renewed", { restaurant_id: sub.restaurant_id });
}

// ──────────────────────────────────────
// Invoice Payment Failed — Mark Past Due (BUG-003)
// ──────────────────────────────────────
async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, restaurant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!sub) return;

  await supabaseAdmin
    .from("restaurants")
    .update({ subscription_status: "past_due" })
    .eq("id", sub.restaurant_id);

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("id", sub.id);

  // Send dunning email to restaurant owner
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("name, email, owner_id")
    .eq("id", sub.restaurant_id)
    .single();

  if (restaurant?.email) {
    await sendEmail({
      to: restaurant.email,
      subject: "Payment failed — update your card to keep OrderFlow active",
      html: `<div style="font-family:sans-serif;padding:20px">
        <h2>Payment Failed</h2>
        <p>We were unable to charge your card for your OrderFlow subscription.</p>
        <p>Please update your payment method in the dashboard to avoid service interruption.</p>
        <p style="margin-top:20px"><a href="${process.env.NEXTAUTH_URL}/dashboard/billing" style="background:#1B4F72;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Update Payment Method</a></p>
      </div>`,
    });
  }

  log.warn("Invoice payment failed", { restaurant_id: sub.restaurant_id, attemptCount: invoice.attempt_count });
}

// ──────────────────────────────────────
// Subscription Updated (BUG-003)
// ──────────────────────────────────────
async function handleSubscriptionUpdated(subscription: any) {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, restaurant_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!sub) return;

  const status = subscription.status === "active" ? "active"
    : subscription.status === "past_due" ? "past_due"
    : subscription.status === "trialing" ? "trialing"
    : "cancelled";

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("id", sub.id);

  await supabaseAdmin
    .from("restaurants")
    .update({ subscription_status: status })
    .eq("id", sub.restaurant_id);

  log.info("Subscription updated", { restaurant_id: sub.restaurant_id, status });
}

// ──────────────────────────────────────
// Subscription Deleted (BUG-003)
// ──────────────────────────────────────
async function handleSubscriptionDeleted(subscription: any) {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, restaurant_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!sub) return;

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", sub.id);

  await supabaseAdmin
    .from("restaurants")
    .update({ subscription_status: "cancelled", is_active: false })
    .eq("id", sub.restaurant_id);

  log.warn("Subscription cancelled", { restaurant_id: sub.restaurant_id });
}

// ──────────────────────────────────────
// Helper: Upsert customer record
// ──────────────────────────────────────
async function upsertCustomer(order: any) {
  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("id, total_orders, total_spent")
    .eq("restaurant_id", order.restaurant_id)
    .eq("email", order.customer_email)
    .single();

  if (existingCustomer) {
    await supabaseAdmin
      .from("customers")
      .update({
        name: order.customer_name,
        phone: order.customer_phone,
        total_orders: existingCustomer.total_orders + 1,
        total_spent: existingCustomer.total_spent + order.total,
        last_order_at: new Date().toISOString(),
      })
      .eq("id", existingCustomer.id);
  } else {
    await supabaseAdmin.from("customers").insert({
      restaurant_id: order.restaurant_id,
      email: order.customer_email,
      name: order.customer_name,
      phone: order.customer_phone,
      total_orders: 1,
      total_spent: order.total,
      last_order_at: new Date().toISOString(),
      gdpr_consent_at: new Date().toISOString(),
    });
  }
}

// ──────────────────────────────────────
// Account Updated — Stripe Connect Onboarding
// ──────────────────────────────────────
async function handleAccountUpdated(account: any) {
  const isReady = account.charges_enabled && account.payouts_enabled;
  if (!isReady) return;

  const restaurantId = account.metadata?.restaurant_id;
  if (!restaurantId) return;

  // Verify the restaurant exists and is waiting for onboarding
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, subscription_status")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) return;

  // Assuming new restaurants are created with trial or waiting for setup
  // We don't overwrite paid status, but we can set them to active if they were trialing
  log.info("Stripe Connect account ready", { restaurant_id: restaurantId, accountId: account.id });
}

// Disable body parsing for webhook signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
