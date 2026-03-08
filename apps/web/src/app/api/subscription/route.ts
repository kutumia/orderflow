import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import Stripe from "stripe";
import { PLANS, SETUP_FEE, type Plan } from "@/lib/feature-gates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// Stripe Price IDs per plan (set in env vars)
const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL || "",
  },
  growth: {
    monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY || "",
    annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL || "",
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || "",
  },
};

// GET /api/subscription — get current subscription status
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("stripe_customer_id, subscription_status, trial_ends_at, plan, setup_fee_paid")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.stripe_customer_id) {
    return NextResponse.json({ status: "no_subscription", plan: restaurant?.plan || "starter" });
  }

  try {
    const subs = await stripe.subscriptions.list({
      customer: restaurant.stripe_customer_id,
      limit: 1,
      status: "all",
    });

    const sub = subs.data[0];
    if (!sub) return NextResponse.json({ status: "no_subscription", plan: restaurant?.plan || "starter" });

    return NextResponse.json({
      status: sub.status,
      plan: restaurant?.plan || "starter",
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
      trial_end: sub.trial_end,
      setup_fee_paid: restaurant?.setup_fee_paid,
    });
  } catch {
    return NextResponse.json({ status: restaurant?.subscription_status || "unknown", plan: restaurant?.plan || "starter" });
  }
}

// POST /api/subscription — create new subscription or setup fee checkout
export async function POST(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json().catch(() => ({}));
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Setup fee checkout
  if (body.action === "setup_fee") {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "gbp",
          unit_amount: SETUP_FEE,
          product_data: { name: "OrderFlow Professional Setup" },
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/dashboard/billing?setup=success`,
      cancel_url: `${baseUrl}/dashboard/billing`,
      metadata: { restaurant_id: restaurantId, type: "setup_fee" },
    });
    return NextResponse.json({ checkout_url: checkoutSession.url });
  }

  // New subscription
  const plan = (body.plan || "starter") as Plan;
  const annual = body.annual === true;
  const priceId = PRICE_IDS[plan]?.[annual ? "annual" : "monthly"];

  // If no Stripe Price IDs configured, create ad-hoc price
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: "gbp",
          unit_amount: annual ? PLANS[plan].annualPrice : PLANS[plan].price,
          recurring: { interval: annual ? "year" as const : "month" as const },
          product_data: { name: `OrderFlow ${PLANS[plan].name} — ${annual ? "Annual" : "Monthly"}` },
        },
        quantity: 1,
      };

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [lineItem],
    subscription_data: { trial_period_days: 14 },
    success_url: `${baseUrl}/dashboard?subscribed=true`,
    cancel_url: `${baseUrl}/dashboard/billing`,
    metadata: { restaurant_id: restaurantId, plan },
  });

  return NextResponse.json({ checkout_url: checkoutSession.url });
}

// PUT /api/subscription — change plan (upgrade/downgrade)
export async function PUT(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();
  const newPlan = body.plan as Plan;
  const annual = body.annual === true;

  if (!["starter", "growth", "pro"].includes(newPlan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("stripe_customer_id, plan")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.stripe_customer_id) {
    // No existing subscription — create checkout
    return NextResponse.json({ error: "no_subscription", checkout_url: "/dashboard/billing" }, { status: 400 });
  }

  try {
    // Get active subscription
    const subs = await stripe.subscriptions.list({
      customer: restaurant.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    const sub = subs.data[0];
    if (!sub) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
    }

    const priceId = PRICE_IDS[newPlan]?.[annual ? "annual" : "monthly"];

    // Update subscription with proration
    if (priceId) {
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: sub.items.data[0].id, price: priceId }],
        proration_behavior: "create_prorations",
      });
    } else {
      // Ad-hoc price update
      await stripe.subscriptions.update(sub.id, {
        items: [{
          id: sub.items.data[0].id,
          price_data: {
            currency: "gbp",
            unit_amount: annual ? PLANS[newPlan].annualPrice : PLANS[newPlan].price,
            recurring: { interval: annual ? "year" : "month" },
            product: sub.items.data[0].price.product as string,
          },
        }],
        proration_behavior: "create_prorations",
      });
    }

    // Update plan in database
    await supabaseAdmin
      .from("restaurants")
      .update({ plan: newPlan, annual_billing: annual })
      .eq("id", restaurantId);

    return NextResponse.json({ success: true, plan: newPlan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
