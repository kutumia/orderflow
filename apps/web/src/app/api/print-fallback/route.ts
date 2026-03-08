import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";
import { log } from "@/lib/logger";

/**
 * POST /api/print-fallback
 * Called internally when a print job fails 3 times.
 * Sends email (and optionally SMS via Twilio) to restaurant owner.
 *
 * Body: { api_key, job_id, order_number, order_type, customer_name, error }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { api_key, job_id, order_number, order_type, customer_name, error } = body;

    if (!api_key || !job_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify API key and get restaurant
    const { data: restaurant } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, print_failure_email, print_failure_sms, alert_phone")
      .eq("printer_api_key", api_key)
      .eq("is_active", true)
      .single();

    if (!restaurant) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Check if fallback already sent for this job
    const { data: job } = await supabaseAdmin
      .from("print_jobs")
      .select("id, fallback_sent")
      .eq("id", job_id)
      .single();

    if (job?.fallback_sent) {
      return NextResponse.json({ success: true, already_sent: true });
    }

    // Mark fallback as sent
    await supabaseAdmin
      .from("print_jobs")
      .update({ fallback_sent: true, fallback_sent_at: new Date().toISOString() })
      .eq("id", job_id);

    // Get owner email
    const { data: owner } = await supabaseAdmin
      .from("users")
      .select("email, name")
      .eq("restaurant_id", restaurant.id)
      .eq("role", "owner")
      .single();

    // Send email alert
    if (restaurant.print_failure_email !== false && owner?.email) {
      await sendEmail({
        to: owner.email,
        subject: `⚠️ Print Failed — Order #${order_number || "?"}`,
        html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f5f5f5">
<div style="max-width:500px;margin:0 auto;padding:20px">
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:#dc2626;padding:24px;text-align:center">
  <h1 style="color:white;margin:0;font-size:20px">⚠️ Print Failed</h1>
</div>
<div style="padding:24px">
  <p style="margin:0 0 12px;font-size:14px;color:#333">
    <strong>Order #${order_number || "?"}</strong> could not be printed after 3 attempts.
  </p>
  <div style="background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:16px">
    <p style="margin:0;font-size:13px;color:#666">
      <strong>Order:</strong> #${order_number || "?"} (${escapeHtml(order_type || "unknown")})<br>
      <strong>Customer:</strong> ${escapeHtml(customer_name || "Unknown")}<br>
      <strong>Error:</strong> ${escapeHtml(error || "Unknown error")}
    </p>
  </div>
  <p style="margin:0 0 16px;font-size:14px;color:#666">
    Please check your printer and reprint the order from your dashboard.
  </p>
  <a href="https://orderflow.co.uk/dashboard/orders" style="display:inline-block;background:#1B4F72;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
    View Order →
  </a>
</div>
<div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:12px;color:#999">
  OrderFlow Print Alert
</div>
</div></div></body></html>`,
      });
    }

    // Send SMS alert via Twilio (if configured)
    if (restaurant.print_failure_sms && restaurant.alert_phone && process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
        const twilioFrom = process.env.TWILIO_FROM_NUMBER;

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            To: restaurant.alert_phone,
            From: twilioFrom || "",
            Body: `OrderFlow: Order #${order_number} could not be printed. Please check your printer and reprint from the dashboard.`,
          }),
        });
      } catch (smsErr: any) {
        log.error("SMS alert failed", { error: smsErr.message, jobId: job_id });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
