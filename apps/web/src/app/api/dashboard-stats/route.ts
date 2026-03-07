import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/dashboard-stats
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Today's orders (confirmed+)
  const { data: todayOrders } = await supabaseAdmin
    .from("orders")
    .select("total, status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", todayStart.toISOString())
    .not("status", "in", '("pending","cancelled")');

  const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + o.total, 0);
  const todayCount = todayOrders?.length || 0;

  // Total customers
  const { count: customerCount } = await supabaseAdmin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  // Avg order value (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentOrders } = await supabaseAdmin
    .from("orders")
    .select("total")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("status", "in", '("pending","cancelled")');

  const avgOrder = recentOrders && recentOrders.length > 0
    ? Math.round(recentOrders.reduce((s, o) => s + o.total, 0) / recentOrders.length)
    : 0;

  // Recent 5 orders
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
