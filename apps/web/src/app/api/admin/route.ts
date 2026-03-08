import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

// Admin-only: platform-level management

// GET /api/admin?type=restaurants|stats
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "stats";

  if (type === "stats") {
    const [
      { count: restaurantCount },
      { count: userCount },
      { count: orderCount },
      { data: revenueData },
    ] = await Promise.all([
      supabaseAdmin.from("restaurants").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).not("status", "eq", "pending"),
      supabaseAdmin.from("orders").select("total").not("status", "in", '("pending","cancelled")'),
    ]);

    const totalRevenue = (revenueData || []).reduce((s, o) => s + o.total, 0);
    const platformFees = Math.round(totalRevenue * 0.015); // 1.5% platform fee

    return NextResponse.json({
      restaurants: restaurantCount || 0,
      users: userCount || 0,
      orders: orderCount || 0,
      total_gmv: totalRevenue,
      platform_fees: platformFees,
    });
  }

  if (type === "restaurants") {
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 25;

    let query = supabaseAdmin
      .from("restaurants")
      .select("id, name, slug, is_active, subscription_status, holiday_mode, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const offset = (page - 1) * limit;
    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get order counts per restaurant
    const restaurantIds = (data || []).map((r) => r.id);
    const { data: orderCounts } = await supabaseAdmin
      .from("orders")
      .select("restaurant_id")
      .in("restaurant_id", restaurantIds)
      .not("status", "eq", "pending");

    const countMap: Record<string, number> = {};
    for (const o of orderCounts || []) {
      countMap[o.restaurant_id] = (countMap[o.restaurant_id] || 0) + 1;
    }

    const enriched = (data || []).map((r) => ({
      ...r,
      order_count: countMap[r.id] || 0,
    }));

    return NextResponse.json({
      restaurants: enriched,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// PUT /api/admin — toggle restaurant active status
export async function PUT(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { restaurant_id, is_active } = body;

  if (!restaurant_id) {
    return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("restaurants")
    .update({ is_active })
    .eq("id", restaurant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
