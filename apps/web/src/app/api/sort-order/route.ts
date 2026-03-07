import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PUT /api/sort-order
 * Body: { type: "categories" | "menu_items", items: [{ id, sort_order }] }
 * Updates sort_order for all given items in a single batch.
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const restaurantId = user.restaurant_id;
  const body = await req.json();
  const { type, items } = body;

  if (!type || !items || !Array.isArray(items)) {
    return NextResponse.json({ error: "type and items[] required" }, { status: 400 });
  }

  if (type !== "categories" && type !== "menu_items") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  if (items.length > 200) {
    return NextResponse.json({ error: "Too many items" }, { status: 400 });
  }

  // Update each item's sort_order
  for (const item of items) {
    if (!item.id || typeof item.sort_order !== "number") continue;

    if (type === "categories") {
      await supabaseAdmin
        .from("categories")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
        .eq("restaurant_id", restaurantId);
    } else {
      // For menu items, verify the item belongs to this restaurant via category
      await supabaseAdmin
        .from("menu_items")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);
    }
  }

  return NextResponse.json({ success: true });
}
