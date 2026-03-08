import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwner, requireSession } from "@/lib/guard";
import { invalidateCache } from "@/lib/cache";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const EDITABLE_FIELDS = [
  "name", "address", "phone", "email", "description",
  "logo_url", "banner_url",
  "delivery_enabled", "collection_enabled",
  "delivery_fee", "min_order_delivery", "min_order_collection",
  "estimated_delivery_mins", "estimated_collection_mins",
  "holiday_mode", "holiday_message",
  "vat_registered", "vat_number",
];

// GET /api/restaurant-settings
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PUT /api/restaurant-settings
export async function PUT(req: NextRequest) {
  const limited = await checkRateLimitAsync(req, "mutation");
  if (limited) return limited;

  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();

  // Filter to only editable fields
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate
  if (updates.name !== undefined && !updates.name?.trim()) {
    return NextResponse.json({ error: "Restaurant name is required" }, { status: 400 });
  }
  if (updates.delivery_fee !== undefined && updates.delivery_fee < 0) {
    return NextResponse.json({ error: "Delivery fee cannot be negative" }, { status: 400 });
  }
  if (updates.estimated_delivery_mins !== undefined && updates.estimated_delivery_mins < 1) {
    return NextResponse.json({ error: "Delivery time must be at least 1 minute" }, { status: 400 });
  }
  if (updates.vat_registered && !updates.vat_number?.trim()) {
    return NextResponse.json({ error: "VAT number required if VAT registered" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("restaurants")
    .update(updates)
    .eq("id", restaurantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await invalidateCache(`restaurant:${restaurantId}`);

  return NextResponse.json({ success: true });
}
