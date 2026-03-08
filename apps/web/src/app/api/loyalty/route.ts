import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireOwner } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/loyalty — get loyalty program config
 * POST /api/loyalty — create/update loyalty program
 * PUT /api/loyalty — earn stamps/points (called from webhook)
 */
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();

  // Stats
  const { count: totalCards } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: activeCards } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .gte("last_earn_at", thirtyDaysAgo);

  const { data: redeemStats } = await supabaseAdmin
    .from("loyalty_cards")
    .select("total_rewards_redeemed")
    .eq("restaurant_id", restaurantId);

  const totalRedeemed = (redeemStats || []).reduce((s, c) => s + (c.total_rewards_redeemed || 0), 0);

  return NextResponse.json({
    program: program || null,
    stats: { totalCards: totalCards || 0, activeCards: activeCards || 0, totalRedeemed },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();

  const programData = {
    restaurant_id: restaurantId,
    type: body.type || "stamps",
    stamps_required: body.stamps_required || 8,
    points_per_pound: body.points_per_pound || 1,
    points_to_redeem: body.points_to_redeem || 100,
    reward_type: body.reward_type || "discount",
    reward_value: body.reward_value || 500,
    reward_item_name: body.reward_item_name || null,
    is_active: body.is_active ?? false,
  };

  // Upsert
  const { data: existing } = await supabaseAdmin
    .from("loyalty_programs")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .single();

  if (existing) {
    await supabaseAdmin.from("loyalty_programs").update(programData).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("loyalty_programs").insert(programData);
  }

  return NextResponse.json({ success: true });
}

/**
 * PUT /api/loyalty — earn stamps/points for a customer after order
 * Body: { restaurant_id, customer_email, order_total }
 * Called internally from webhook handler.
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { restaurant_id, customer_email, order_total } = body;

  if (!restaurant_id || !customer_email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Get loyalty program
  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("is_active", true)
    .single();

  if (!program) return NextResponse.json({ skipped: true });

  // Get or create loyalty card
  let { data: card } = await supabaseAdmin
    .from("loyalty_cards")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("customer_email", customer_email.toLowerCase())
    .single();

  if (!card) {
    const { data: newCard } = await supabaseAdmin
      .from("loyalty_cards")
      .insert({ restaurant_id, customer_email: customer_email.toLowerCase() })
      .select()
      .single();
    card = newCard;
  }

  if (!card) return NextResponse.json({ error: "Card creation failed" }, { status: 500 });

  // Earn
  const updates: any = { last_earn_at: new Date().toISOString() };

  if (program.type === "stamps") {
    updates.stamps_earned = (card.stamps_earned || 0) + 1;
  } else {
    // Points: 1 point per £1 (configurable)
    const pointsEarned = Math.floor((order_total / 100) * (program.points_per_pound || 1));
    updates.points_balance = (card.points_balance || 0) + pointsEarned;
  }

  await supabaseAdmin.from("loyalty_cards").update(updates).eq("id", card.id);

  return NextResponse.json({ success: true, earned: updates });
}
