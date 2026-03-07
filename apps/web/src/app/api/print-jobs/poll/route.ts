import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { formatPlainTextReceipt, type ReceiptOrder } from "@/lib/receipt";

// DEPRECATED: Use /api/pb/v1/poll instead. This route will be removed in a future version.

/**
 * GET /api/print-jobs/poll?api_key=xxx&device_id=yyy
 *
 * Called by the printer agent to fetch queued print jobs.
 * Supports multi-device: if device_id is provided, only returns jobs assigned to that device
 * or unassigned jobs. Jobs are returned in priority order (highest first).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get("api_key");
  const deviceId = searchParams.get("device_id");

  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  // Look up restaurant by printer API key
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id, name")
    .eq("printer_api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Fetch queued print jobs (priority DESC, then created_at ASC)
  let query = supabaseAdmin
    .from("print_jobs")
    .select("id, order_id, device_id, priority, receipt_data, orders(order_number, order_type, customer_name, customer_phone, delivery_address, items, subtotal, delivery_fee, discount, vat_amount, total, notes, created_at)")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "queued")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);

  // Multi-device filtering: get jobs for this device or unassigned
  if (deviceId) {
    query = query.or(`device_id.eq.${deviceId},device_id.is.null`);
  }

  const { data: jobs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ jobs: [] });
  }

  // Mark jobs as "printing" (claimed by agent)
  const jobIds = jobs.map((j) => j.id);
  await supabaseAdmin
    .from("print_jobs")
    .update({ status: "printing", device_id: deviceId || undefined })
    .in("id", jobIds);

  // Format receipts
  const formattedJobs = jobs.map((job) => {
    const order = job.orders as any;
    if (!order) return { job_id: job.id, receipt_text: null };

    // Prefer pre-stored receipt data (BUG-018)
    if (job.receipt_data) {
      return {
        job_id: job.id,
        order_id: job.order_id,
        order_number: order.order_number,
        order_type: order.order_type,
        customer_name: order.customer_name,
        priority: job.priority,
        receipt_text: job.receipt_data,
      };
    }

    // Fallback: format on the fly
    const receiptData: ReceiptOrder = {
      order_number: order.order_number,
      order_type: order.order_type,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.delivery_address,
      notes: order.notes,
      items: order.items || [],
      subtotal: order.subtotal,
      delivery_fee: order.delivery_fee,
      discount: order.discount,
      total: order.total,
      created_at: order.created_at,
      restaurant_name: restaurant.name,
    };

    return {
      job_id: job.id,
      order_id: job.order_id,
      order_number: order.order_number,
      order_type: order.order_type,
      customer_name: order.customer_name,
      priority: job.priority,
      receipt_text: formatPlainTextReceipt(receiptData),
    };
  });

  return NextResponse.json({ jobs: formattedJobs });
}

/**
 * POST /api/print-jobs/poll — agent reports job completion/failure
 *
 * Triggers print fallback alert after 3 consecutive failures.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { api_key, job_id, status, error: printError } = body;

  if (!api_key || !job_id || !status) {
    return NextResponse.json({ error: "api_key, job_id, and status required" }, { status: 400 });
  }

  // Verify API key
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("id")
    .eq("printer_api_key", api_key)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const updateData: any = { status };

  if (status === "printed") {
    updateData.printed_at = new Date().toISOString();
  }

  if (status === "failed") {
    updateData.error_message = printError || "Print failed";

    const { data: job } = await supabaseAdmin
      .from("print_jobs")
      .select("retry_count, order_id, orders(order_number, order_type, customer_name)")
      .eq("id", job_id)
      .single();

    const retryCount = (job?.retry_count || 0) + 1;
    updateData.retry_count = retryCount;

    if (retryCount < 3) {
      // Auto-requeue
      updateData.status = "queued";
      updateData.error_message = `Retry ${retryCount}: ${printError}`;
    } else {
      // 3 failures — trigger fallback alert
      updateData.status = "failed";
      const order = job?.orders as any;

      // Fire and forget the fallback alert
      try {
        const serverUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "";
        fetch(`${serverUrl}/api/print-fallback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key,
            job_id,
            order_number: order?.order_number,
            order_type: order?.order_type,
            customer_name: order?.customer_name,
            error: printError,
          }),
        }).catch(() => {}); // Fire and forget
      } catch {
        // Non-critical
      }
    }
  }

  await supabaseAdmin
    .from("print_jobs")
    .update(updateData)
    .eq("id", job_id)
    .eq("restaurant_id", restaurant.id);

  return NextResponse.json({ success: true });
}
