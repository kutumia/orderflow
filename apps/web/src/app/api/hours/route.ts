import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/hours
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
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
