import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/loyalty/check?restaurant_id=xxx&email=yyy
 * Public — customer checks their loyalty card progress (read-only, no PII mutation).
 *
 * POST /api/loyalty/check — redeem reward
 * Body: { restaurant_id, email, order_id, customer_token }
 *
 * [P0 FIX] POST previously accepted only {restaurant_id, email}, allowing anyone
 * to drain any customer's loyalty balance by knowing their email address.
 * Now the caller must prove they placed an order by supplying the order_id and
 * customer_token returned by /api/checkout. The token is a random 32-char hex
 * string stored on the order — without it, guessing the order UUID is not enough.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurant_id");
  const email = searchParams.get("email");

  if (!restaurantId || !email) {
    return NextResponse.json({ error: "restaurant_id and email required" }, { status: 400 });
  }

  // Get program
  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("type, stamps_required, points_to_redeem, reward_type, reward_value, reward_item_name, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .single();

  if (!program) {
    return NextResponse.json({ active: false });
  }

  // Get card
  const { data: card } = await supabaseAdmin
    .from("loyalty_cards")
    .select("stamps_earned, stamps_redeemed, points_balance, total_rewards_redeemed")
    .eq("restaurant_id", restaurantId)
    .eq("customer_email", email.toLowerCase())
    .single();

  if (!card) {
    return NextResponse.json({
      active: true,
      program,
      card: null,
      canRedeem: false,
    });
  }

  // Calculate redeemability
  let canRedeem = false;
  if (program.type === "stamps") {
    const availableStamps = (card.stamps_earned || 0) - (card.stamps_redeemed || 0);
    canRedeem = availableStamps >= program.stamps_required;
  } else {
    canRedeem = (card.points_balance || 0) >= program.points_to_redeem;
  }

  return NextResponse.json({
    active: true,
    program,
    card,
    canRedeem,
  });
}

/**
 * POST /api/loyalty/check — redeem a reward
 * Body: { restaurant_id, email, order_id, customer_token }
 * Returns the discount to apply.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { restaurant_id, email, order_id, customer_token } = body;

  if (!restaurant_id || !email || !order_id || !customer_token) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify the caller placed the specified order (proof of customer identity).
  // order_id is a UUID — hard to guess but not a secret on its own.
  // customer_token is a random 32-char hex value returned only at checkout time,
  // making cross-customer redemption impossible without the checkout response.
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("customer_email, customer_token")
    .eq("id", order_id)
    .eq("restaurant_id", restaurant_id)
    .single();

  if (
    !order ||
    order.customer_token !== customer_token ||
    order.customer_email !== email.toLowerCase()
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("is_active", true)
    .single();

  if (!program) return NextResponse.json({ error: "No active loyalty program" }, { status: 400 });

  const { data: card } = await supabaseAdmin
    .from("loyalty_cards")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("customer_email", email.toLowerCase())
    .single();

  if (!card) return NextResponse.json({ error: "No loyalty card found" }, { status: 404 });

  // Validate and redeem
  if (program.type === "stamps") {
    const available = (card.stamps_earned || 0) - (card.stamps_redeemed || 0);
    if (available < program.stamps_required) {
      return NextResponse.json({ error: "Not enough stamps" }, { status: 400 });
    }

    await supabaseAdmin
      .from("loyalty_cards")
      .update({
        stamps_redeemed: (card.stamps_redeemed || 0) + program.stamps_required,
        total_rewards_redeemed: (card.total_rewards_redeemed || 0) + 1,
      })
      .eq("id", card.id);
  } else {
    if ((card.points_balance || 0) < program.points_to_redeem) {
      return NextResponse.json({ error: "Not enough points" }, { status: 400 });
    }

    await supabaseAdmin
      .from("loyalty_cards")
      .update({
        points_balance: (card.points_balance || 0) - program.points_to_redeem,
        total_rewards_redeemed: (card.total_rewards_redeemed || 0) + 1,
      })
      .eq("id", card.id);
  }

  return NextResponse.json({
    redeemed: true,
    reward_type: program.reward_type,
    reward_value: program.reward_value,
    reward_item_name: program.reward_item_name,
  });
}
