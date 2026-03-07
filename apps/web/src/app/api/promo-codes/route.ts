import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/promo-codes
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/promo-codes — create new promo code
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  const { code, type, value, min_order, expiry, max_uses } = body;

  // Validate
  if (!code?.trim()) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }
  if (!type || !["percentage", "fixed", "free_delivery"].includes(type)) {
    return NextResponse.json({ error: "Invalid promo type" }, { status: 400 });
  }
  if (type !== "free_delivery" && (!value || value <= 0)) {
    return NextResponse.json({ error: "Value must be greater than 0" }, { status: 400 });
  }
  if (type === "percentage" && value > 100) {
    return NextResponse.json({ error: "Percentage cannot exceed 100%" }, { status: 400 });
  }

  // Check for duplicate code
  const { data: existing } = await supabaseAdmin
    .from("promo_codes")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("code", code.toUpperCase().trim())
    .single();

  if (existing) {
    return NextResponse.json({ error: "This code already exists" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .insert({
      restaurant_id: restaurantId,
      code: code.toUpperCase().trim(),
      type,
      value: type === "free_delivery" ? 0 : value,
      min_order: min_order || 0,
      expiry: expiry || null,
      max_uses: max_uses || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT /api/promo-codes — update promo code
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Promo code ID required" }, { status: 400 });

  // Only allow certain fields to be updated
  const allowed: Record<string, any> = {};
  if ("is_active" in updates) allowed.is_active = updates.is_active;
  if ("value" in updates) allowed.value = updates.value;
  if ("min_order" in updates) allowed.min_order = updates.min_order;
  if ("expiry" in updates) allowed.expiry = updates.expiry;
  if ("max_uses" in updates) allowed.max_uses = updates.max_uses;

  const { error } = await supabaseAdmin
    .from("promo_codes")
    .update(allowed)
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/promo-codes?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Promo code ID required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("promo_codes")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
