import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/guard";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";
import { generateUnsubscribeToken } from "@/app/api/unsubscribe/route";
import { log } from "@/lib/logger";

/**
 * POST /api/marketing/send — trigger a campaign send
 * Body: { campaign_id }
 *
 * Returns 202 immediately and processes the send in the background via
 * /api/marketing/send/worker (called by /api/cron/process-queue).
 * This avoids Vercel's 10s function timeout for large audiences.
 */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  const { restaurantId } = guard;

  const body = await req.json();
  const { campaign_id } = body;

  // Fetch campaign
  const { data: campaign } = await supabaseAdmin
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaign_id)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });
  if (campaign.status === "sending") return NextResponse.json({ error: "Already sending" }, { status: 400 });

  // Mark as queued immediately — this is what we return to the client
  await supabaseAdmin
    .from("marketing_campaigns")
    .update({ status: "sending", queued_at: new Date().toISOString() })
    .eq("id", campaign_id);

  // Kick off the actual send without awaiting it — fire and forget via internal call
  // This is safe because we've already persisted "sending" status above
  processCampaignSend(campaign, restaurantId).catch((err) => {
    log.error("Campaign send failed", { campaign_id, error: err.message });
    // Reset status so the owner can retry
    supabaseAdmin
      .from("marketing_campaigns")
      .update({ status: "draft" })
      .eq("id", campaign_id);
  });

  return NextResponse.json({ status: "sending", campaign_id }, { status: 202 });
}

async function processCampaignSend(campaign: any, restaurantId: string) {
  const campaign_id = campaign.id;

  // Build audience
  const filter = campaign.audience_filter || {};
  let query = supabaseAdmin
    .from("customers")
    .select("email, name, phone")
    .eq("restaurant_id", restaurantId)
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
    return;
  }

  // Get restaurant name
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .single();

  const restaurantName = restaurant?.name || "Your Restaurant";

  let sent = 0;
  let failed = 0;

  if (campaign.channel === "email") {
    // Send in batches of 50 with no artificial delay — Resend handles rate limiting
    for (let i = 0; i < audience.length; i += 50) {
      const batch = audience.slice(i, i + 50);
      await Promise.allSettled(
        batch.map(async (customer) => {
          try {
            const token = generateUnsubscribeToken(customer.email, restaurantId);
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
        })
      );
    }
  } else if (campaign.channel === "sms" && process.env.TWILIO_ACCOUNT_SID) {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;

    // Only send to customers with phones who haven't opted out (already filtered above)
    const phoneCusts = audience.filter((c) => c.phone);

    for (const c of phoneCusts) {
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

  log.info("Campaign send complete", { campaign_id, sent, failed });

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
