import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwner } from "@/lib/guard";

/**
 * GET /api/shopify/settings?shop=xxx.myshopify.com
 * Returns the linked OrderFlow restaurant slug for this Shopify store.
 */
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.json({ error: "shop required" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("shopify_shops")
    .select("shop, restaurant_slug, is_active, installed_at")
    .eq("shop", shop)
    .single();

  if (!data) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  return NextResponse.json(data);
}

/**
 * PUT /api/shopify/settings
 * Links a Shopify store to an OrderFlow restaurant slug.
 * Body: { shop, restaurant_slug }
 *
 * [P1 FIX] Previously unauthenticated — anyone could remap any Shopify store
 * to any restaurant slug. Now requires an owner session.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const { shop, restaurant_slug } = await req.json();

  if (!shop || !restaurant_slug) {
    return NextResponse.json({ error: "shop and restaurant_slug required" }, { status: 400 });
  }

  // Validate the slug exists AND belongs to the authenticated owner's restaurant.
  // Without the .eq("id", guard.restaurantId) guard, owner A could link owner B's
  // restaurant slug to their Shopify store.
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug")
    .eq("slug", restaurant_slug)
    .eq("id", guard.restaurantId)
    .eq("is_active", true)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found or not active" }, { status: 404 });
  }

  // Update the shop link
  const { error } = await supabaseAdmin
    .from("shopify_shops")
    .update({ restaurant_slug })
    .eq("shop", shop);

  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });

  return NextResponse.json({ success: true, restaurant_name: restaurant.name });
}
