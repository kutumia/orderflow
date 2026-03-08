import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSession } from "@/lib/guard";

// GET /api/categories — list categories for authenticated restaurant
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/categories — create a new category
export async function POST(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({
      restaurant_id: restaurantId,
      name: body.name.trim(),
      sort_order: nextOrder,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT /api/categories — update category (name, sort_order, is_active)
export async function PUT(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();

  if (!body.id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
  }

  if (body.reorder && Array.isArray(body.items)) {
    const updates = body.items.map((item: { id: string; sort_order: number }) =>
      supabaseAdmin
        .from("categories")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
        .eq("restaurant_id", restaurantId)
    );
    await Promise.all(updates);
    return NextResponse.json({ success: true });
  }

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin
    .from("categories")
    .update(updateData)
    .eq("id", body.id)
    .eq("restaurant_id", restaurantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/categories — delete a category
export async function DELETE(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Category ID required" }, { status: 400 });

  const { count } = await supabaseAdmin
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: category has ${count} item(s). Move or delete them first.` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
