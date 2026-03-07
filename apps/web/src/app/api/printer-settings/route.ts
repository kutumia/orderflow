import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { randomBytes } from "crypto";

// GET /api/printer-settings — get current printer API key
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;

  const { data } = await supabaseAdmin
    .from("restaurants")
    .select("printer_api_key")
    .eq("id", restaurantId)
    .single();

  return NextResponse.json({
    printer_api_key: data?.printer_api_key || null,
  });
}

// POST /api/printer-settings — generate a new printer API key
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  if (body.action === "generate_key") {
    const newKey = `ofp_${randomBytes(24).toString("hex")}`;

    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ printer_api_key: newKey })
      .eq("id", restaurantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ printer_api_key: newKey });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
