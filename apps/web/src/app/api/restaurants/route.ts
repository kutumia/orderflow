import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cached } from "@/lib/cache";

// GET /api/restaurants?slug=marios-pizza
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  // Cache entire payload for 5 minutes (Edge/Redis)
  const payload = await cached(`restaurant_full:${slug}`, 300, async () => {
    // 1. Fetch restaurant row
    const { data: restaurant, error } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    if (error || !restaurant) return null;

    // 2. Fetch dependencies
    const [
      { data: categories },
      { data: items },
      { data: hours },
    ] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("menu_items")
        .select("*, item_modifiers(*)")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("opening_hours")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("day_of_week", { ascending: true })
    ]);

    // Group items by category
    const menuByCategory = (categories || []).map((cat) => ({
      ...cat,
      items: (items || []).filter((item) => item.category_id === cat.id),
    }));

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo_url: restaurant.logo_url,
        banner_url: restaurant.banner_url,
        address: restaurant.address,
        phone: restaurant.phone,
        description: restaurant.description,
        delivery_enabled: restaurant.delivery_enabled,
        collection_enabled: restaurant.collection_enabled,
        delivery_fee: restaurant.delivery_fee,
        min_order_delivery: restaurant.min_order_delivery,
        min_order_collection: restaurant.min_order_collection,
        estimated_delivery_mins: restaurant.estimated_delivery_mins,
        estimated_collection_mins: restaurant.estimated_collection_mins,
        holiday_mode: restaurant.holiday_mode,
        holiday_message: restaurant.holiday_message,
        vat_registered: restaurant.vat_registered,
        vat_rate: restaurant.vat_rate,
      },
      menu: menuByCategory,
      hours: hours || [],
    };
  });

  if (!payload) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  // Calculate `isOpen` dynamically since it depends on the current time which shouldn't be heavily cached
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Ensure UK time offset logic for open/close checking, but server time is okay for now
  const currentTime = now.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).replace(':', ':');

  const todayHours = payload.hours.find((h: any) => h.day_of_week === dayOfWeek);
  const isOpen =
    !payload.restaurant.holiday_mode &&
    todayHours &&
    !todayHours.is_closed &&
    currentTime >= todayHours.open_time &&
    currentTime <= todayHours.close_time;

  return NextResponse.json({
    ...payload,
    isOpen,
  });
}
