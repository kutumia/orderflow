import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { generateUnsubscribeToken } from "@/app/api/unsubscribe/route";
import { canSendToCustomer, checkSmsCap, sendAlert } from "@/lib/security";
import crypto from "crypto";

/**
 * POST /api/cron/engagement
 * Called daily (e.g. via Vercel Cron at 10am).
 * Evaluates engagement triggers per restaurant.
 *
 * Fix #10: Idempotent — uses cron lock to prevent double-runs.
 * Fix #12: Email throttling via canSendToCustomer.
 *
 * Set CRON_SECRET env var and pass as Authorization header.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fix #10: Cron lock — prevent concurrent execution
  const lockKey = `cron:engagement:${new Date().toISOString().slice(0, 10)}`;
  const { data: existingLock } = await supabaseAdmin
    .from("audit_logs")
    .select("id")
    .eq("action", "cron_start")
    .eq("resource_type", "engagement")
    .eq("resource_id", lockKey)
    .single();

  if (existingLock) {
    return NextResponse.json({ ok: true, message: "Already ran today", skipped: true });
  }

  // Acquire lock
  await supabaseAdmin.from("audit_logs").insert({
    action: "cron_start",
    resource_type: "engagement",
    resource_id: lockKey,
    details: { started_at: new Date().toISOString() },
  });

  const results = { we_miss_you: 0, loyalty_ready: 0, reorder: 0, digest: 0 };

  // Get all active restaurants on Growth+ plan
  const { data: restaurants } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug, plan, email")
    .eq("is_active", true)
    .in("plan", ["growth", "pro"]);

  for (const restaurant of restaurants || []) {
    try {
      // 19.2a: "We miss you" — customers with no order in 14 days
      await processWeMissYou(restaurant);
      results.we_miss_you++;

      // 19.2b: Loyalty ready — customers with full stamp cards
      await processLoyaltyReady(restaurant);
      results.loyalty_ready++;

      // 19.3: Reorder reminders — customers overdue by 50%+
      await processReorderReminders(restaurant);
      results.reorder++;

      // 19.2c: Weekly digest (Mondays only)
      if (new Date().getDay() === 1) {
        await processWeeklyDigest(restaurant);
        results.digest++;
      }
    } catch (err) {
      // Continue with other restaurants
    }
  }

  return NextResponse.json({ ok: true, processed: restaurants?.length || 0, results });
}

// ── "We Miss You" ──

async function processWeMissYou(restaurant: any) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

  // Customers with last order > 14 days ago, not already emailed in last 30 days
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, email, name, last_order_at, last_reminder_sent_at")
    .eq("restaurant_id", restaurant.id)
    .eq("marketing_opt_out", false)
    .eq("gdpr_deleted", false)
    .lt("last_order_at", fourteenDaysAgo)
    .not("email", "is", null);

  for (const customer of (customers || []).slice(0, 50)) {
    // Skip if reminded in last 30 days
    if (customer.last_reminder_sent_at && new Date(customer.last_reminder_sent_at) > new Date(Date.now() - 30 * 86400000)) continue;

    // Fix #12: Email throttling — max 3 automated emails per customer per 24h
    const canSend = await canSendToCustomer(restaurant.id, customer.email, 24);
    if (!canSend) continue;

    // Already sent this trigger recently?
    const { count } = await supabaseAdmin
      .from("automation_logs")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("customer_email", customer.email)
      .eq("trigger_type", "we_miss_you")
      .gt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
    if ((count || 0) > 0) continue;

    // Generate one-time promo code
    const promoCode = `MISSYOU-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await supabaseAdmin.from("promo_codes").insert({
      restaurant_id: restaurant.id,
      code: promoCode,
      type: "percentage",
      value: 10,
      max_uses: 1,
      uses: 0,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      is_active: true,
    });

    const unsubToken = generateUnsubscribeToken(customer.email, restaurant.id);
    const unsubUrl = `${process.env.NEXTAUTH_URL || ""}/api/unsubscribe?token=${unsubToken}`;
    const orderUrl = `${process.env.NEXTAUTH_URL || ""}/${restaurant.slug}`;

    await sendEmail({
      to: customer.email,
      subject: `We miss you at ${restaurant.name}! Here's 10% off 💛`,
      html: weMissYouHtml(customer.name || "there", restaurant.name, promoCode, orderUrl, unsubUrl),
    });

    // Log
    await supabaseAdmin.from("automation_logs").insert({
      restaurant_id: restaurant.id,
      trigger_type: "we_miss_you",
      customer_email: customer.email,
      channel: "email",
      promo_code: promoCode,
    });

    await supabaseAdmin.from("customers").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", customer.id);
  }
}

// ── Loyalty Ready ──

async function processLoyaltyReady(restaurant: any) {
  const { data: program } = await supabaseAdmin
    .from("loyalty_programs")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .single();
  if (!program) return;

  // Find cards where stamps_earned >= stamps_required and not yet notified
  const { data: cards } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id, customer_email, stamps_earned, points_balance")
    .eq("restaurant_id", restaurant.id)
    .gte("stamps_earned", program.stamps_required || 999);

  for (const card of (cards || []).slice(0, 50)) {
    if (!card.customer_email) continue;

    // Check not already notified
    const { count } = await supabaseAdmin
      .from("automation_logs")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("customer_email", card.customer_email)
      .eq("trigger_type", "loyalty_ready")
      .gt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    if ((count || 0) > 0) continue;

    const unsubToken = generateUnsubscribeToken(card.customer_email, restaurant.id);
    const unsubUrl = `${process.env.NEXTAUTH_URL || ""}/api/unsubscribe?token=${unsubToken}`;
    const orderUrl = `${process.env.NEXTAUTH_URL || ""}/${restaurant.slug}`;

    await sendEmail({
      to: card.customer_email,
      subject: `You've earned a reward at ${restaurant.name}! 🎉`,
      html: loyaltyReadyHtml(restaurant.name, program.reward_description || "a free reward", orderUrl, unsubUrl),
    });

    await supabaseAdmin.from("automation_logs").insert({
      restaurant_id: restaurant.id,
      trigger_type: "loyalty_ready",
      customer_email: card.customer_email,
      channel: "email",
    });
  }
}

// ── Reorder Reminders ──

async function processReorderReminders(restaurant: any) {
  // Get customers with known frequency who are overdue
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, email, name, avg_order_frequency_days, last_order_at, last_reminder_sent_at")
    .eq("restaurant_id", restaurant.id)
    .eq("marketing_opt_out", false)
    .eq("gdpr_deleted", false)
    .gt("avg_order_frequency_days", 0)
    .not("email", "is", null);

  for (const customer of (customers || []).slice(0, 50)) {
    if (!customer.last_order_at || !customer.avg_order_frequency_days) continue;

    const daysSinceOrder = (Date.now() - new Date(customer.last_order_at).getTime()) / 86400000;
    const threshold = customer.avg_order_frequency_days * 1.5;

    if (daysSinceOrder < threshold) continue;

    // Skip if reminded in last 14 days
    if (customer.last_reminder_sent_at && new Date(customer.last_reminder_sent_at) > new Date(Date.now() - 14 * 86400000)) continue;

    const unsubToken = generateUnsubscribeToken(customer.email, restaurant.id);
    const unsubUrl = `${process.env.NEXTAUTH_URL || ""}/api/unsubscribe?token=${unsubToken}`;
    const orderUrl = `${process.env.NEXTAUTH_URL || ""}/${restaurant.slug}`;

    await sendEmail({
      to: customer.email,
      subject: `Ready to order again from ${restaurant.name}?`,
      html: reorderHtml(customer.name || "there", restaurant.name, orderUrl, unsubUrl),
    });

    await supabaseAdmin.from("automation_logs").insert({
      restaurant_id: restaurant.id,
      trigger_type: "reorder_reminder",
      customer_email: customer.email,
      channel: "email",
    });

    await supabaseAdmin.from("customers").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", customer.id);
  }
}

// ── Weekly Digest ──

async function processWeeklyDigest(restaurant: any) {
  if (!restaurant.email) return;

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400000);
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000);

  // This week's stats
  const { data: thisWeek } = await supabaseAdmin
    .from("orders")
    .select("total, created_at")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", weekStart.toISOString())
    .in("status", ["confirmed", "preparing", "ready", "out_for_delivery", "delivered", "collected"]);

  // Last week's stats
  const { data: lastWeek } = await supabaseAdmin
    .from("orders")
    .select("total")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", prevWeekStart.toISOString())
    .lt("created_at", weekStart.toISOString())
    .in("status", ["confirmed", "preparing", "ready", "out_for_delivery", "delivered", "collected"]);

  // New customers this week
  const { count: newCustomers } = await supabaseAdmin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", weekStart.toISOString());

  const thisRevenue = (thisWeek || []).reduce((s, o) => s + (o.total || 0), 0);
  const lastRevenue = (lastWeek || []).reduce((s, o) => s + (o.total || 0), 0);
  const revenueChange = lastRevenue > 0 ? Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 100) : 0;

  await sendEmail({
    to: restaurant.email,
    subject: `${restaurant.name} — Weekly Digest`,
    html: weeklyDigestHtml(restaurant.name, {
      orders: (thisWeek || []).length,
      ordersLast: (lastWeek || []).length,
      revenue: thisRevenue,
      revenueLast: lastRevenue,
      revenueChange,
      newCustomers: newCustomers || 0,
    }),
  });

  await supabaseAdmin.from("automation_logs").insert({
    restaurant_id: restaurant.id,
    trigger_type: "weekly_digest",
    channel: "email",
  });
}

// ── Email Templates ──

function weMissYouHtml(name: string, restaurant: string, code: string, orderUrl: string, unsubUrl: string) {
  return emailWrap(restaurant, `
    <p style="margin:0 0 12px;font-size:14px;color:#666">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#333">It's been a while since your last order from <strong>${restaurant}</strong>. We'd love to see you back!</p>
    <p style="margin:0 0 8px;font-size:14px;color:#333">Here's <strong>10% off</strong> your next order:</p>
    <div style="background:#f0f9ff;border-radius:8px;padding:16px;text-align:center;margin:0 0 16px">
      <span style="font-size:24px;font-weight:700;color:#1B4F72;font-family:monospace">${code}</span>
      <p style="margin:8px 0 0;font-size:12px;color:#666">Valid for 7 days. One-time use.</p>
    </div>
    <a href="${orderUrl}" style="display:block;background:#1B4F72;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Order Now →</a>
  `, unsubUrl);
}

function loyaltyReadyHtml(restaurant: string, reward: string, orderUrl: string, unsubUrl: string) {
  return emailWrap(restaurant, `
    <p style="margin:0 0 16px;font-size:14px;color:#333">Great news! You've earned <strong>${reward}</strong> at <strong>${restaurant}</strong>.</p>
    <p style="margin:0 0 16px;font-size:14px;color:#666">Place your next order and your reward will be applied automatically at checkout.</p>
    <a href="${orderUrl}" style="display:block;background:#1B4F72;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Claim Your Reward →</a>
  `, unsubUrl);
}

function reorderHtml(name: string, restaurant: string, orderUrl: string, unsubUrl: string) {
  return emailWrap(restaurant, `
    <p style="margin:0 0 12px;font-size:14px;color:#666">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#333">Ready to order again from <strong>${restaurant}</strong>? Your usual is just one tap away.</p>
    <a href="${orderUrl}" style="display:block;background:#1B4F72;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Order Again →</a>
  `, unsubUrl);
}

function weeklyDigestHtml(restaurant: string, stats: any) {
  const f = (v: number) => `£${(v / 100).toFixed(2)}`;
  const arrow = stats.revenueChange >= 0 ? "📈" : "📉";
  return emailWrap(restaurant, `
    <p style="margin:0 0 16px;font-size:14px;color:#333">Here's your weekly summary for <strong>${restaurant}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#666">Orders</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600;text-align:right">${stats.orders} <span style="color:#999;font-weight:400">(last week: ${stats.ordersLast})</span></td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#666">Revenue</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600;text-align:right">${f(stats.revenue)} ${arrow} ${stats.revenueChange}%</td></tr>
      <tr><td style="padding:8px 0;font-size:13px;color:#666">New Customers</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right">${stats.newCustomers}</td></tr>
    </table>
    <a href="${process.env.NEXTAUTH_URL || ""}/dashboard/reports" style="display:block;background:#1B4F72;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Full Report →</a>
  `, "");
}

function emailWrap(restaurant: string, body: string, unsubUrl: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f5f5f5">
<div style="max-width:500px;margin:0 auto;padding:20px">
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:#1B4F72;padding:24px;text-align:center">
  <h1 style="color:white;margin:0;font-size:20px">${restaurant}</h1>
</div>
<div style="padding:24px">${body}</div>
<div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:11px;color:#999">
  Powered by OrderFlow${unsubUrl ? ` · <a href="${unsubUrl}" style="color:#999">Unsubscribe</a>` : ""}
</div>
</div></div></body></html>`;
}
