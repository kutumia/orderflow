import { NextRequest, NextResponse } from "next/server";
import { authenticatePB } from "@/lib/pb-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/pb/v1/webhooks
 * List recent webhook deliveries for the tenant.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  const { data } = await supabaseAdmin
    .from("pb_webhook_deliveries")
    .select("id, event, url, status_code, attempt, status, created_at")
    .eq("tenant_id", auth.tenant.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ deliveries: data || [] });
}

/**
 * POST /api/pb/v1/webhooks/test
 * Send a test webhook to the tenant's webhook URL.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticatePB(req);
  if (!auth.ok) return auth.response;

  if (!auth.tenant.webhook_url) {
    return NextResponse.json({ error: "No webhook URL configured" }, { status: 400 });
  }

  const testPayload = {
    event: "test",
    job_id: "test-00000000",
    status: "printed",
    device_id: "test-device",
    order_id: null,
    timestamp: new Date().toISOString(),
    _test: true,
  };

  try {
    const res = await fetch(auth.tenant.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OrderFlow-Event": "test",
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    // Log the test delivery
    await supabaseAdmin.from("pb_webhook_deliveries").insert({
      tenant_id: auth.tenant.id,
      event: "test",
      url: auth.tenant.webhook_url,
      payload: testPayload,
      status_code: res.status,
      status: res.ok ? "delivered" : "failed",
    });

    return NextResponse.json({
      success: res.ok,
      status_code: res.status,
      url: auth.tenant.webhook_url,
    });
  } catch (err: any) {
    await supabaseAdmin.from("pb_webhook_deliveries").insert({
      tenant_id: auth.tenant.id,
      event: "test",
      url: auth.tenant.webhook_url,
      payload: testPayload,
      status: "failed",
    });

    return NextResponse.json({
      success: false,
      error: err.message || "Connection failed",
      url: auth.tenant.webhook_url,
    });
  }
}
