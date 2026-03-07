import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

// DEPRECATED: Use /api/pb/v1/heartbeat instead. This route will be removed in a future version.

/**
 * POST /api/print-heartbeat — agent sends periodic heartbeat
 *
 * Body: {
 *   api_key: string,
 *   device_name?: string,
 *   printer_name?: string,
 *   paper_width?: number,
 *   agent_version?: string,
 *   os_platform?: string,
 *   os_version?: string,
 *   status?: "online" | "error",
 *   last_error?: string,
 *   total_printed?: number,
 *   total_failed?: number,
 * }
 */
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, 120, 60_000); // 2/sec max
  if (limited) return limited;

  try {
    const body = await req.json();
    const { api_key, ...deviceInfo } = body;

    if (!api_key) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    // Look up restaurant by printer API key
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("printer_api_key", api_key)
      .eq("is_active", true)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Upsert device record (match by restaurant_id + device_name)
    const deviceName = deviceInfo.device_name || "Kitchen Printer";

    const { data: existingDevice } = await supabaseAdmin
      .from("printer_devices")
      .select("id, total_printed, total_failed")
      .eq("restaurant_id", restaurant.id)
      .eq("device_name", deviceName)
      .single();

    const deviceData = {
      restaurant_id: restaurant.id,
      device_name: deviceName,
      printer_name: deviceInfo.printer_name || null,
      paper_width: deviceInfo.paper_width || 80,
      agent_version: deviceInfo.agent_version || null,
      os_platform: deviceInfo.os_platform || null,
      os_version: deviceInfo.os_version || null,
      last_heartbeat: new Date().toISOString(),
      is_online: true,
      status: deviceInfo.status || "online",
      last_error: deviceInfo.last_error || null,
      total_printed: deviceInfo.total_printed ?? existingDevice?.total_printed ?? 0,
      total_failed: deviceInfo.total_failed ?? existingDevice?.total_failed ?? 0,
    };

    if (existingDevice) {
      await supabaseAdmin
        .from("printer_devices")
        .update(deviceData)
        .eq("id", existingDevice.id);
    } else {
      const { data: newDevice } = await supabaseAdmin
        .from("printer_devices")
        .insert(deviceData)
        .select("id")
        .single();
      if (newDevice) {
        return NextResponse.json({ success: true, device_id: newDevice.id });
      }
    }

    // Update restaurant's agent version for quick access
    if (deviceInfo.agent_version) {
      await supabaseAdmin
        .from("restaurants")
        .update({ printer_agent_version: deviceInfo.agent_version })
        .eq("id", restaurant.id);
    }

    return NextResponse.json({
      success: true,
      device_id: existingDevice?.id || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}

/**
 * GET /api/print-heartbeat?api_key=xxx — agent checks server connectivity
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get("api_key");

  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name")
    .eq("printer_api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return NextResponse.json({
    connected: true,
    restaurant_name: restaurant.name,
    server_time: new Date().toISOString(),
  });
}
