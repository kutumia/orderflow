import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { auditLog, userCanAccessRestaurant } from "@/lib/security";

/**
 * GET /api/locations — list all restaurants owned by this user
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { data: links } = await supabaseAdmin
    .from("user_restaurants")
    .select("restaurant_id, role, is_primary, restaurants(id, name, slug, is_active, plan, address)")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false });

  const locations = (links || []).map((l: any) => ({
    id: l.restaurants.id,
    name: l.restaurants.name,
    slug: l.restaurants.slug,
    is_active: l.restaurants.is_active,
    plan: l.restaurants.plan,
    address: l.restaurants.address,
    role: l.role,
    is_primary: l.is_primary,
    is_current: l.restaurants.id === user.restaurant_id,
  }));

  return NextResponse.json({ locations, current: user.restaurant_id });
}

/**
 * PUT /api/locations — switch active restaurant
 * Body: { restaurant_id }
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { restaurant_id } = await req.json();
  if (!restaurant_id) return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });

  // Verify user owns this restaurant (Fix #16: strict permission check)
  const hasAccess = await userCanAccessRestaurant(user.id, restaurant_id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Not your restaurant" }, { status: 403 });
  }

  // Update user's active restaurant
  await supabaseAdmin
    .from("users")
    .update({ restaurant_id })
    .eq("id", user.id);

  // Fix #19: Audit log
  await auditLog({
    user_id: user.id,
    restaurant_id,
    action: "switch_location",
    resource_type: "location",
    resource_id: restaurant_id,
  });

  return NextResponse.json({ success: true, restaurant_id });
}

/**
 * POST /api/locations — add a new location
 * Body: { name, address, slug, postcode, clone_from_restaurant_id? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  // Only Pro plan can add locations
  const { data: currentRestaurant } = await supabaseAdmin
    .from("restaurants")
    .select("plan")
    .eq("id", user.restaurant_id)
    .single();

  if (currentRestaurant?.plan !== "pro") {
    return NextResponse.json({ error: "Multi-location requires Pro plan" }, { status: 403 });
  }

  const body = await req.json();
  const { name, address, slug, postcode, clone_from_restaurant_id } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug required" }, { status: 400 });
  }

  // Check slug availability
  const { data: existing } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("slug", slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
    .single();

  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  // Create restaurant
  const { data: newRestaurant, error: createError } = await supabaseAdmin
    .from("restaurants")
    .insert({
      name,
      address: address || null,
      postcode: postcode || null,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      plan: "pro",
      is_active: false,
      onboarding_step: 0,
    })
    .select()
    .single();

  if (createError || !newRestaurant) {
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }

  // Link user to new restaurant
  await supabaseAdmin.from("user_restaurants").insert({
    user_id: user.id,
    restaurant_id: newRestaurant.id,
    role: "owner",
    is_primary: false,
  });

  // Clone menu if requested
  if (clone_from_restaurant_id) {
    await cloneMenu(clone_from_restaurant_id, newRestaurant.id);
  }

  return NextResponse.json({ success: true, restaurant: newRestaurant }, { status: 201 });
}

async function cloneMenu(sourceId: string, targetId: string) {
  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("name, sort_order, is_active")
    .eq("restaurant_id", sourceId)
    .order("sort_order", { ascending: true });

  for (const cat of categories || []) {
    const { data: newCat } = await supabaseAdmin
      .from("categories")
      .insert({ ...cat, restaurant_id: targetId })
      .select()
      .single();

    if (!newCat) continue;

    const { data: items } = await supabaseAdmin
      .from("menu_items")
      .select("name, description, price, image_url, sort_order, is_available, allergens, modifiers")
      .eq("restaurant_id", sourceId)
      .eq("category_id", (await supabaseAdmin.from("categories").select("id").eq("restaurant_id", sourceId).eq("name", cat.name).single()).data?.id);

    for (const item of items || []) {
      await supabaseAdmin.from("menu_items").insert({
        ...item,
        restaurant_id: targetId,
        category_id: newCat.id,
      });
    }
  }
}
