import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSession } from "@/lib/guard";

// GET /api/hours
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { data, error } = await supabaseAdmin
    .from("opening_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/hours — batch update all hours
export async function PUT(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const { hours } = await req.json();

  if (!Array.isArray(hours)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const updates = hours.map((h: any) =>
    supabaseAdmin
      .from("opening_hours")
      .update({
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      })
      .eq("id", h.id)
      .eq("restaurant_id", restaurantId)
  );

  await Promise.all(updates);
  return NextResponse.json({ success: true });
}
