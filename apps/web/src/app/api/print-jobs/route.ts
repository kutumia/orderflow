import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/print-jobs?status=queued|printing|printed|failed
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("print_jobs")
    .select("*, orders(order_number, order_type, customer_name, customer_phone, delivery_address, items, subtotal, delivery_fee, discount, total, notes, created_at, status)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/print-jobs — update print job status
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  const { job_id, status, error: printError } = body;

  if (!job_id || !status) {
    return NextResponse.json({ error: "Job ID and status required" }, { status: 400 });
  }

  const updateData: any = { status };
  if (status === "printed") updateData.printed_at = new Date().toISOString();
  if (status === "failed") {
    updateData.error_message = printError || "Unknown error";
    // Increment retry count
    const { data: job } = await supabaseAdmin
      .from("print_jobs")
      .select("retry_count")
      .eq("id", job_id)
      .single();
    updateData.retry_count = (job?.retry_count || 0) + 1;
  }

  const { error } = await supabaseAdmin
    .from("print_jobs")
    .update(updateData)
    .eq("id", job_id)
    .eq("restaurant_id", restaurantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST /api/print-jobs — requeue a failed print job
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = (session.user as any).restaurant_id;
  const body = await req.json();

  if (body.requeue && body.job_id) {
    const { error } = await supabaseAdmin
      .from("print_jobs")
      .update({ status: "queued", error_message: null })
      .eq("id", body.job_id)
      .eq("restaurant_id", restaurantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Manual print: create a new print job for an existing order
  if (body.order_id) {
    const { data, error } = await supabaseAdmin
      .from("print_jobs")
      .insert({
        restaurant_id: restaurantId,
        order_id: body.order_id,
        status: "queued",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
