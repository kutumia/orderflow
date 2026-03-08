import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/menu-templates — list user's menu templates
 */
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const { data } = await supabaseAdmin
    .from("menu_templates")
    .select("id, name, source_restaurant_id, created_at, template_data")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    templates: (data || []).map((t) => ({
      ...t,
      category_count: (t.template_data as any)?.categories?.length || 0,
      item_count: ((t.template_data as any)?.categories || []).reduce(
        (s: number, c: any) => s + (c.items?.length || 0), 0
      ),
    })),
  });
}

/**
 * POST /api/menu-templates — save current restaurant's menu as template
 * Body: { name }
 */
export async function POST(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { user, restaurantId } = guard;

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Fetch current menu
  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("name, sort_order")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const templateCategories = [];
  for (const cat of categories || []) {
    const { data: items } = await supabaseAdmin
      .from("menu_items")
      .select("name, description, price, allergens, modifiers, sort_order")
      .eq("restaurant_id", restaurantId)
      .eq("category_id", (await supabaseAdmin.from("categories").select("id").eq("restaurant_id", restaurantId).eq("name", cat.name).single()).data?.id)
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    templateCategories.push({
      name: cat.name,
      sort_order: cat.sort_order,
      items: (items || []).map((i) => ({
        name: i.name,
        description: i.description,
        price: i.price,
        allergens: i.allergens,
        modifiers: i.modifiers,
        sort_order: i.sort_order,
      })),
    });
  }

  const { data, error } = await supabaseAdmin
    .from("menu_templates")
    .insert({
      owner_user_id: user.id,
      name,
      source_restaurant_id: restaurantId,
      template_data: { categories: templateCategories },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to save template" }, { status: 500 });

  return NextResponse.json({ template: data }, { status: 201 });
}

/**
 * PUT /api/menu-templates — apply template to a restaurant
 * Body: { template_id, target_restaurant_id }
 */
export async function PUT(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const { template_id, target_restaurant_id } = await req.json();

  // Verify ownership of template and target
  const { data: template } = await supabaseAdmin
    .from("menu_templates")
    .select("template_data")
    .eq("id", template_id)
    .eq("owner_user_id", user.id)
    .single();

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data: link } = await supabaseAdmin
    .from("user_restaurants")
    .select("id")
    .eq("user_id", user.id)
    .eq("restaurant_id", target_restaurant_id)
    .single();

  if (!link) return NextResponse.json({ error: "Not your restaurant" }, { status: 403 });

  // Apply template
  const categories = (template.template_data as any).categories || [];
  let itemsCreated = 0;

  for (const cat of categories) {
    const { data: newCat } = await supabaseAdmin
      .from("categories")
      .insert({
        restaurant_id: target_restaurant_id,
        name: cat.name,
        sort_order: cat.sort_order || 0,
        is_active: true,
      })
      .select()
      .single();

    if (!newCat) continue;

    for (const item of cat.items || []) {
      await supabaseAdmin.from("menu_items").insert({
        restaurant_id: target_restaurant_id,
        category_id: newCat.id,
        name: item.name,
        description: item.description,
        price: item.price,
        allergens: item.allergens || [],
        modifiers: item.modifiers || [],
        sort_order: item.sort_order || 0,
        is_available: true,
      });
      itemsCreated++;
    }
  }

  return NextResponse.json({
    success: true,
    categories_created: categories.length,
    items_created: itemsCreated,
  });
}
