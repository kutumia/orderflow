import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/printer-devices — list all devices for the restaurant
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;

  const { data: devices, error } = await supabaseAdmin
    .from("printer_devices")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark devices as offline if no heartbeat in 2 minutes
  const now = Date.now();
  const enriched = (devices || []).map((d) => {
    const lastBeat = d.last_heartbeat ? new Date(d.last_heartbeat).getTime() : 0;
    const isOnline = now - lastBeat < 120_000; // 2 minutes
    return {
      ...d,
      is_online: isOnline,
      status: isOnline ? "online" : "offline",
    };
  });

  return NextResponse.json(enriched);
}

/**
 * PUT /api/printer-devices — update device settings (name, categories, connection type)
 * Body: { device_id, device_name?, assigned_categories?, connection_type?, network_host?, network_port?, is_default? }
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const restaurantId = user.restaurant_id;
  const body = await req.json();
  const { device_id, ...updates } = body;

  if (!device_id) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

  // Only allow specific fields
  const allowed: Record<string, any> = {};
  if (updates.device_name !== undefined) allowed.device_name = updates.device_name.substring(0, 100);
  if (updates.assigned_categories !== undefined) allowed.assigned_categories = updates.assigned_categories;
  if (updates.connection_type !== undefined) allowed.connection_type = updates.connection_type;
  if (updates.network_host !== undefined) allowed.network_host = updates.network_host;
  if (updates.network_port !== undefined) allowed.network_port = parseInt(updates.network_port) || 9100;
  if (updates.is_default !== undefined) {
    allowed.is_default = updates.is_default;
    // Unset other defaults
    if (updates.is_default) {
      await supabaseAdmin
        .from("printer_devices")
        .update({ is_default: false })
        .eq("restaurant_id", restaurantId)
        .neq("id", device_id);
    }
  }

  const { error } = await supabaseAdmin
    .from("printer_devices")
    .update(allowed)
    .eq("id", device_id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/printer-devices?device_id=xxx — remove a device
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");

  if (!deviceId) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

  await supabaseAdmin
    .from("printer_devices")
    .delete()
    .eq("id", deviceId)
    .eq("restaurant_id", user.restaurant_id);

  return NextResponse.json({ success: true });
}
