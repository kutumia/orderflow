import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import {
  createConnectAccount,
  createOnboardingLink,
  isAccountReady,
  createDashboardLink,
} from "@/lib/stripe";
import { log } from "@/lib/logger";

// POST /api/stripe/connect — start Connect onboarding
export async function POST(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;
  const sessionUser = guard.session.user as any;

  // Fetch restaurant
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, email, stripe_account_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") || "http://localhost:3000";

  try {
    let accountId = restaurant.stripe_account_id;

    // Create account if doesn't exist
    if (!accountId) {
      const account = await createConnectAccount(
        restaurantId,
        restaurant.email || sessionUser.email,
        restaurant.name
      );
      accountId = account.id;

      await supabaseAdmin
        .from("restaurants")
        .update({ stripe_account_id: accountId })
        .eq("id", restaurantId);
    }

    // Check if already onboarded
    const ready = await isAccountReady(accountId);
    if (ready) {
      const dashboardUrl = await createDashboardLink(accountId);
      return NextResponse.json({ status: "complete", dashboardUrl });
    }

    // Create onboarding link
    const url = await createOnboardingLink(
      accountId,
      `${origin}/dashboard/billing?stripe=success`,
      `${origin}/dashboard/billing?stripe=refresh`
    );

    return NextResponse.json({ status: "onboarding", url });
  } catch (err: any) {
    log.error("Stripe Connect error", { error: err.message, restaurantId });
    return NextResponse.json(
      { error: err.message || "Failed to set up payments" },
      { status: 500 }
    );
  }
}

// GET /api/stripe/connect — check status
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("stripe_account_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant?.stripe_account_id) {
    return NextResponse.json({ status: "not_started" });
  }

  try {
    const ready = await isAccountReady(restaurant.stripe_account_id);
    if (ready) {
      const dashboardUrl = await createDashboardLink(restaurant.stripe_account_id);
      return NextResponse.json({ status: "complete", dashboardUrl });
    }
    return NextResponse.json({ status: "incomplete" });
  } catch {
    return NextResponse.json({ status: "incomplete" });
  }
}
