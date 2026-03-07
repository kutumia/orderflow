import { NextRequest, NextResponse } from "next/server";
import { authenticatePB } from "@/lib/pb-auth";
import { getDevices } from "@/lib/printbridge";

/**
 * GET /api/pb/v1/devices
 * List printer devices for the tenant's restaurant.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  if (!auth.tenant.restaurant_id) {
    return NextResponse.json({ error: "Tenant not linked to restaurant" }, { status: 400 });
  }

  const devices = await getDevices(auth.tenant.restaurant_id);

  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      device_id: d.device_id,
      device_name: d.device_name,
      printer_name: d.printer_name,
      paper_width: d.paper_width,
      connection_type: d.connection_type,
      is_online: d.is_online,
      last_heartbeat: d.last_heartbeat,
    })),
  });
}
