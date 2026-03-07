import { NextRequest, NextResponse } from "next/server";
import { authenticatePB } from "@/lib/pb-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/pb/v1/heartbeat
 * Agent sends periodic heartbeat with device info.
 * Body: { device_id, device_name?, printer_name?, paper_width?, connection_type?, app_version? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  if (!auth.tenant.restaurant_id) {
    return NextResponse.json({ error: "Tenant not linked to restaurant" }, { status: 400 });
  }

  const body = await req.json();
  const { device_id, device_name, printer_name, paper_width, connection_type, app_version } = body;

  if (!device_id) {
    return NextResponse.json({ error: "device_id required" }, { status: 400 });
  }

  // Upsert device
  const { data: existing } = await supabaseAdmin
    .from("printer_devices")
    .select("id")
    .eq("device_id", device_id)
    .eq("restaurant_id", auth.tenant.restaurant_id)
    .single();

  const now = new Date().toISOString();

  if (existing) {
    await supabaseAdmin
      .from("printer_devices")
      .update({
        last_heartbeat: now,
        is_online: true,
        ...(printer_name ? { printer_name } : {}),
        ...(paper_width ? { paper_width } : {}),
        ...(connection_type ? { connection_type } : {}),
        ...(app_version ? { app_version } : {}),
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin
      .from("printer_devices")
      .insert({
        restaurant_id: auth.tenant.restaurant_id,
        device_id,
        device_name: device_name || `Device ${device_id.substring(0, 8)}`,
        printer_name: printer_name || "Unknown Printer",
        paper_width: paper_width || 80,
        connection_type: connection_type || "usb",
        is_online: true,
        last_heartbeat: now,
        app_version: app_version || "unknown",
      });
  }

  return NextResponse.json({ ok: true, server_time: now });
}

/**
 * GET /api/pb/v1/heartbeat
 * Agent checks server connectivity.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ok: true,
    tenant: auth.tenant.name,
    server_time: new Date().toISOString(),
  });
}
