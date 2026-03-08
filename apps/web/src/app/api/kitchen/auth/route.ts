import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimitAsync } from "@/lib/rate-limit";

// POST /api/kitchen/auth — validate kitchen PIN
export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per minute per IP (brute force protection)
  const limited = await checkRateLimitAsync(req, "login");
  if (limited) return limited;

  const body = await req.json();
  const { slug, pin } = body;

  if (!slug || !pin) {
    return NextResponse.json({ error: "Slug and PIN are required" }, { status: 400 });
  }

  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, kitchen_pin")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  // If no PIN is set, allow access (backward compatible)
  if (!restaurant.kitchen_pin) {
    return NextResponse.json({ valid: true });
  }

  if (restaurant.kitchen_pin !== pin) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  return NextResponse.json({ valid: true });
}
