import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSession, requireManager } from "@/lib/guard";
import { invalidateCache } from "@/lib/cache";
import { z } from "zod";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const HourSchema = z.object({
  id:         z.string().uuid("Invalid hour row ID"),
  open_time:  z.string().regex(/^\d{2}:\d{2}$/, "open_time must be HH:MM"),
  close_time: z.string().regex(/^\d{2}:\d{2}$/, "close_time must be HH:MM"),
  is_closed:  z.boolean(),
});

const hoursUpdateSchema = z.object({
  hours: z.array(HourSchema).min(1, "At least one hour row required").max(7, "Maximum 7 days"),
});

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

  if (error) return NextResponse.json({ error: "Failed to fetch hours" }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/hours — batch update all hours
// Restricted to manager+ so staff cannot alter operating hours.
export async function PUT(req: NextRequest) {
  const limited = await checkRateLimitAsync(req, "mutation");
  if (limited) return limited;

  const guard = await requireManager(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();
  const parseResult = hoursUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { hours } = parseResult.data;

  const updates = hours.map((h) =>
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
  await invalidateCache(`hours:${restaurantId}`);
  return NextResponse.json({ success: true });
}
