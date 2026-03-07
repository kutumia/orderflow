import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
 */
export async function PUT(req: NextRequest) {
  const { shop, restaurant_slug } = await req.json();

  if (!shop || !restaurant_slug) {
    return NextResponse.json({ error: "shop and restaurant_slug required" }, { status: 400 });
  }

  // Validate the slug exists
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug")
    .eq("slug", restaurant_slug)
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
