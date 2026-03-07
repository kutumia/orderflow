import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cached } from "@/lib/cache";

/**
 * GET /api/widget?slug=marios-pizza
 * Returns restaurant + menu data for the embeddable ordering widget.
 * CORS-enabled for cross-origin embedding.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return cors(NextResponse.json({ error: "slug required" }, { status: 400 }));
  }

  const data = await cached(`widget:${slug}`, 120, async () => {
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, slug, description, logo_url, brand_colour, delivery_enabled, collection_enabled, delivery_fee, min_order, is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (!restaurant) return null;

    const { data: categories } = await supabaseAdmin
      .from("categories")
      .select("id, name, sort_order")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const { data: items } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, description, image_url, category_id, is_available")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true);

    return {
      restaurant: {
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        logo_url: restaurant.logo_url,
        brand_colour: restaurant.brand_colour || "#1B4F72",
        delivery_enabled: restaurant.delivery_enabled,
        collection_enabled: restaurant.collection_enabled,
        delivery_fee: restaurant.delivery_fee,
        min_order: restaurant.min_order,
      },
      categories: (categories || []).map((cat) => ({
        ...cat,
        items: (items || []).filter((i) => i.category_id === cat.id),
      })),
    };
  });

  if (!data) {
    return cors(NextResponse.json({ error: "Restaurant not found" }, { status: 404 }));
  }

  return cors(NextResponse.json(data));
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Cache-Control", "public, s-maxage=120");
  return res;
}
