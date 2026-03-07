import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/customers?search=&sort=total_spent&dir=desc&page=1&limit=25&export=csv
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search")?.trim() || "";
  const sort = searchParams.get("sort") || "last_order_at";
  const dir = searchParams.get("dir") === "asc" ? true : false;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
  const exportCsv = searchParams.get("export") === "csv";

  const validSorts = ["name", "email", "total_orders", "total_spent", "last_order_at", "created_at"];
  const sortCol = validSorts.includes(sort) ? sort : "last_order_at";

  let query = supabaseAdmin
    .from("customers")
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  query = query.order(sortCol, { ascending: dir });

  if (exportCsv) {
    // Fetch all for export
    const { data } = await query.limit(10000);
    if (!data || data.length === 0) {
      return new NextResponse("No customers to export", { status: 404 });
    }

    const header = "Name,Email,Phone,Total Orders,Total Spent (£),Last Order,First Seen";
    const rows = data.map((c) =>
      [
        `"${(c.name || "").replace(/"/g, '""')}"`,
        c.email,
        c.phone || "",
        c.total_orders,
        (c.total_spent / 100).toFixed(2),
        c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("en-GB") : "",
        new Date(c.created_at).toLocaleDateString("en-GB"),
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=customers-${new Date().toISOString().split("T")[0]}.csv`,
      },
    });
  }

  // Paginated response
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    customers: data || [],
    total: count || 0,
    page,
    limit,
    pages: Math.ceil((count || 0) / limit),
  });
}

// PUT /api/customers — update customer tags
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();
  const { id, tags } = body;

  if (!id) return NextResponse.json({ error: "Customer ID required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ tags: tags || [] })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
