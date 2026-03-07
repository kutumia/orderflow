import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";
import { generateUnsubscribeToken } from "@/app/api/unsubscribe/route";

/**
 * POST /api/marketing/send — send a campaign
 * Body: { campaign_id }
 *
 * Builds audience from filter, sends in batches of 50 with 1s delay.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user.role !== "owner") return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const body = await req.json();
  const { campaign_id } = body;

  // Fetch campaign
  const { data: campaign } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaign_id)
    .eq("restaurant_id", user.restaurant_id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });

  // Mark as sending
  await supabaseAdmin
    .from("marketing_campaigns")
    .update({ status: "sending" })
    .eq("id", campaign_id);

  // Build audience
  const filter = campaign.audience_filter || {};
  let query = supabaseAdmin
    .from("customers")
    .select("email, name")
    .eq("restaurant_id", user.restaurant_id)
    .eq("gdpr_deleted", false)
    .eq("marketing_opt_out", false);

  if (filter.min_orders) query = query.gte("order_count", filter.min_orders);
  if (filter.max_orders) query = query.lte("order_count", filter.max_orders);
  if (filter.min_spent) query = query.gte("total_spent", filter.min_spent);
  if (filter.last_order_before) query = query.lte("last_order_at", filter.last_order_before);
  if (filter.last_order_after) query = query.gte("last_order_at", filter.last_order_after);
  if (filter.tags?.length > 0) query = query.contains("tags", filter.tags);

  const { data: audience } = await query.limit(5000);

  if (!audience || audience.length === 0) {
    await supabaseAdmin
      .from("marketing_campaigns")
      .update({ status: "sent", sent_count: 0, sent_at: new Date().toISOString() })
      .eq("id", campaign_id);
    return NextResponse.json({ sent: 0 });
  }

  // Get restaurant name
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("name")
    .eq("id", user.restaurant_id)
    .single();

  const restaurantName = restaurant?.name || "Your Restaurant";

  // Send in batches
  let sent = 0;
  let failed = 0;

  if (campaign.channel === "email") {
    for (let i = 0; i < audience.length; i += 50) {
      const batch = audience.slice(i, i + 50);

      for (const customer of batch) {
        try {
          const token = generateUnsubscribeToken(customer.email, user.restaurant_id);
          const unsubUrl = `${process.env.NEXTAUTH_URL || ""}/api/unsubscribe?token=${token}`;
          const html = buildEmailHtml(
            campaign.body,
            escapeHtml(customer.name || "Valued Customer"),
            escapeHtml(restaurantName),
            unsubUrl
          );
          await sendEmail({
            to: customer.email,
            subject: campaign.subject || `News from ${restaurantName}`,
            html,
          });
          sent++;
        } catch {
          failed++;
        }
      }

      // 1s delay between batches
      if (i + 50 < audience.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } else if (campaign.channel === "sms" && process.env.TWILIO_ACCOUNT_SID) {
    // SMS via Twilio
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;

    // Get customer phones
    const { data: phoneCusts } = await supabaseAdmin
      .from("customers")
      .select("phone, name")
      .eq("restaurant_id", user.restaurant_id)
      .not("phone", "is", null);

    for (const c of phoneCusts || []) {
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            To: c.phone,
            From: twilioFrom || "",
            Body: campaign.body.substring(0, 160),
          }),
        });
        sent++;
      } catch {
        failed++;
      }
    }
  }

  // Update campaign stats
  await supabaseAdmin
    .from("marketing_campaigns")
    .update({
      status: "sent",
      sent_count: sent,
      sent_at: new Date().toISOString(),
      stats: { sent, failed, audience_size: audience.length },
    })
    .eq("id", campaign_id);

  return NextResponse.json({ sent, failed });
}

function buildEmailHtml(body: string, customerName: string, restaurantName: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f5f5f5">
<div style="max-width:500px;margin:0 auto;padding:20px">
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:#1B4F72;padding:24px;text-align:center">
  <h1 style="color:white;margin:0;font-size:20px">${restaurantName}</h1>
</div>
<div style="padding:24px">
  <p style="margin:0 0 12px;font-size:14px;color:#666">Hi ${customerName},</p>
  <div style="font-size:14px;color:#333;line-height:1.6">${body}</div>
</div>
<div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:11px;color:#999">
  Powered by OrderFlow · <a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a>
</div>
</div></div></body></html>`;
}
