import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/menu-items?category_id=xxx (optional filter)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("category_id");

  let query = supabaseAdmin
    .from("menu_items")
    .select("*, item_modifiers(*)")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/menu-items — create a new menu item
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 });
  }
  if (!body.category_id) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }
  if (body.price === undefined || body.price < 0) {
    return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
  }

  // Get next sort order within category
  const { data: existing } = await supabaseAdmin
    .from("menu_items")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("category_id", body.category_id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .insert({
      restaurant_id: restaurantId,
      category_id: body.category_id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      price: Math.round(body.price), // pence
      image_url: body.image_url || null,
      is_available: body.is_available !== undefined ? body.is_available : true,
      is_popular: body.is_popular || false,
      sort_order: nextOrder,
      allergens: body.allergens || [],
      calories: body.calories || null,
      vat_rate: body.vat_rate || 20.0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create modifiers if provided
  if (body.modifiers && Array.isArray(body.modifiers) && body.modifiers.length > 0) {
    const modifiers = body.modifiers.map((mod: any, i: number) => ({
      item_id: data.id,
      name: mod.name,
      options: mod.options || [],
      required: mod.required || false,
      max_choices: mod.max_choices || 1,
      sort_order: i,
    }));
    await supabaseAdmin.from("item_modifiers").insert(modifiers);
  }

  return NextResponse.json(data, { status: 201 });
}

// PUT /api/menu-items — update a menu item
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  if (!body.id) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  // Quick availability toggle
  if (body.toggle_availability !== undefined) {
    const { data, error } = await supabaseAdmin
      .from("menu_items")
      .update({ is_available: body.toggle_availability })
      .eq("id", body.id)
      .eq("restaurant_id", restaurantId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.price !== undefined) updateData.price = Math.round(body.price);
  if (body.image_url !== undefined) updateData.image_url = body.image_url;
  if (body.is_available !== undefined) updateData.is_available = body.is_available;
  if (body.is_popular !== undefined) updateData.is_popular = body.is_popular;
  if (body.category_id !== undefined) updateData.category_id = body.category_id;
  if (body.allergens !== undefined) updateData.allergens = body.allergens;
  if (body.calories !== undefined) updateData.calories = body.calories;
  if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .update(updateData)
    .eq("id", body.id)
    .eq("restaurant_id", restaurantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update modifiers if provided
  if (body.modifiers !== undefined && Array.isArray(body.modifiers)) {
    // Delete existing modifiers and re-create
    await supabaseAdmin.from("item_modifiers").delete().eq("item_id", body.id);

    if (body.modifiers.length > 0) {
      const modifiers = body.modifiers.map((mod: any, i: number) => ({
        item_id: body.id,
        name: mod.name,
        options: mod.options || [],
        required: mod.required || false,
        max_choices: mod.max_choices || 1,
        sort_order: i,
      }));
      await supabaseAdmin.from("item_modifiers").insert(modifiers);
    }
  }

  return NextResponse.json(data);
}

// DELETE /api/menu-items?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Item ID required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
