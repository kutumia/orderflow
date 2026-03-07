import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/promo-codes/validate
export async function POST(req: NextRequest) {
  const { code, restaurant_id, subtotal } = await req.json();

  if (!code || !restaurant_id) {
    return NextResponse.json({ error: "Code and restaurant_id required" }, { status: 400 });
  }

  const { data: promo, error } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single();

  if (error || !promo) {
    return NextResponse.json({ error: "Invalid promo code" }, { status: 404 });
  }

  // Check expiry
  if (promo.expiry && new Date(promo.expiry) < new Date()) {
    return NextResponse.json({ error: "This code has expired" }, { status: 400 });
  }

  // Check max uses
  if (promo.max_uses && promo.use_count >= promo.max_uses) {
    return NextResponse.json({ error: "This code has reached its usage limit" }, { status: 400 });
  }

  // Check minimum order
  if (subtotal < promo.min_order) {
    return NextResponse.json(
      { error: `Minimum order of £${(promo.min_order / 100).toFixed(2)} required for this code` },
      { status: 400 }
    );
  }

  // Calculate discount
  let discount = 0;
  if (promo.type === "percentage") {
    discount = Math.round(subtotal * (promo.value / 100));
  } else if (promo.type === "fixed") {
    discount = Math.min(promo.value, subtotal);
  }
  // free_delivery handled on checkout (delivery fee set to 0)

  return NextResponse.json({
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discount,
    description:
      promo.type === "percentage"
        ? `${promo.value}% off`
        : promo.type === "fixed"
        ? `£${(promo.value / 100).toFixed(2)} off`
        : "Free delivery",
  });
}
