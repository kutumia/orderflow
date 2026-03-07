import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/reports?type=revenue|popular_items|summary&period=7d|30d|90d|all
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "summary";
  const period = searchParams.get("period") || "30d";

  const periodDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, all: 3650 };
  const days = periodDays[period] || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Completed statuses (not pending or cancelled)
  const completedFilter = `status.not.in.("pending","cancelled")`;

  if (type === "summary") {
    // Overall summary stats for the period
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("total, delivery_fee, discount, subtotal, order_type, status")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since.toISOString())
      .not("status", "in", '("pending","cancelled")');

    const allOrders = orders || [];
    const totalRevenue = allOrders.reduce((s, o) => s + o.total, 0);
    const totalOrders = allOrders.length;
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const deliveryOrders = allOrders.filter((o) => o.order_type === "delivery").length;
    const collectionOrders = allOrders.filter((o) => o.order_type === "collection").length;
    const totalDeliveryFees = allOrders.reduce((s, o) => s + (o.delivery_fee || 0), 0);
    const totalDiscounts = allOrders.reduce((s, o) => s + (o.discount || 0), 0);
    const refunded = allOrders.filter((o) => o.status === "refunded").length;

    const { count: customerCount } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId);

    return NextResponse.json({
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      avg_order_value: avgOrder,
      delivery_orders: deliveryOrders,
      collection_orders: collectionOrders,
      total_delivery_fees: totalDeliveryFees,
      total_discounts: totalDiscounts,
      refunded_orders: refunded,
      total_customers: customerCount || 0,
      period,
    });
  }

  if (type === "revenue") {
    // Daily revenue for chart
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("total, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since.toISOString())
      .not("status", "in", '("pending","cancelled")')
      .order("created_at", { ascending: true });

    // Aggregate by day
    const dailyMap: Record<string, { revenue: number; count: number }> = {};

    // Pre-fill all days in range
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { revenue: 0, count: 0 };
    }

    for (const order of orders || []) {
      const day = new Date(order.created_at).toISOString().split("T")[0];
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, count: 0 };
      dailyMap[day].revenue += order.total;
      dailyMap[day].count += 1;
    }

    const chartData = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        revenue: data.revenue,
        orders: data.count,
      }));

    return NextResponse.json({ chart: chartData, period });
  }

  if (type === "popular_items") {
    // Top selling items
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("items")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since.toISOString())
      .not("status", "in", '("pending","cancelled")');

    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const order of orders || []) {
      for (const item of order.items || []) {
        const key = item.name || item.item_id;
        if (!itemMap[key]) itemMap[key] = { name: item.name, quantity: 0, revenue: 0 };
        itemMap[key].quantity += item.quantity;
        itemMap[key].revenue += item.price * item.quantity;
      }
    }

    const sorted = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    return NextResponse.json({ items: sorted, period });
  }

  if (type === "hourly") {
    // Orders by hour of day
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since.toISOString())
      .not("status", "in", '("pending","cancelled")');

    const hourly = new Array(24).fill(0);
    for (const order of orders || []) {
      const hour = new Date(order.created_at).getHours();
      hourly[hour]++;
    }

    const chartData = hourly.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      orders: count,
    }));

    return NextResponse.json({ chart: chartData, period });
  }

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
}
