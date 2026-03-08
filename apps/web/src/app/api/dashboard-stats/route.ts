import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSession } from "@/lib/guard";

// GET /api/dashboard-stats
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayOrders } = await supabaseAdmin
    .from("orders")
    .select("total, status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", todayStart.toISOString())
    .not("status", "in", '("pending","cancelled")');

  const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + o.total, 0);
  const todayCount = todayOrders?.length || 0;

  const { count: customerCount } = await supabaseAdmin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentOrders } = await supabaseAdmin
    .from("orders")
    .select("total")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("status", "in", '("pending","cancelled")');

  const avgOrder =
    recentOrders && recentOrders.length > 0
      ? Math.round(recentOrders.reduce((s, o) => s + o.total, 0) / recentOrders.length)
      : 0;

  const { data: recent } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, customer_name, total, status, order_type, created_at")
    .eq("restaurant_id", restaurantId)
    .not("status", "eq", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    today_revenue: todayRevenue,
    today_orders: todayCount,
    total_customers: customerCount || 0,
    avg_order_value: avgOrder,
    recent_orders: recent || [],
  });
}
