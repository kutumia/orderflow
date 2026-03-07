import { NextRequest, NextResponse } from "next/server";
import { authenticatePB } from "@/lib/pb-auth";
import { createJob } from "@/lib/printbridge";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/pb/v1/jobs
 * Create a new print job.
 * Body: { device_id?, receipt_data, order_id?, priority? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  if (!auth.tenant.restaurant_id) {
    return NextResponse.json({ error: "Tenant not linked to restaurant" }, { status: 400 });
  }

  const body = await req.json();
  const { device_id, receipt_data, order_id, priority } = body;

  if (!receipt_data) {
    return NextResponse.json({ error: "receipt_data required" }, { status: 400 });
  }

  try {
    const job = await createJob({
      tenantId: auth.tenant.id,
      restaurantId: auth.tenant.restaurant_id,
      orderId: order_id,
      deviceId: device_id,
      receiptData: receipt_data,
      priority: priority || 0,
    });

    if (!job) {
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err: any) {
    if (err.message === "Monthly job limit exceeded") {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * GET /api/pb/v1/jobs?status=queued&limit=20
 * List jobs for the tenant's restaurant.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  if (!auth.tenant.restaurant_id) {
    return NextResponse.json({ error: "Tenant not linked to restaurant" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  let query = supabaseAdmin
    .from("print_jobs")
    .select("id, status, device_id, order_id, priority, attempts, error_message, created_at, printed_at")
    .eq("restaurant_id", auth.tenant.restaurant_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data } = await query;

  return NextResponse.json({ jobs: data || [] });
}
