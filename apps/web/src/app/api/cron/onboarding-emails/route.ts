import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";
import crypto from "crypto";

/**
 * GET /api/cron/onboarding-emails
 *
 * Vercel Cron job (runs daily). Checks all restaurants and sends
 * onboarding emails based on their creation date.
 *
 * Add to vercel.json:
 * { "crons": [{ "path": "/api/cron/onboarding-emails", "schedule": "0 9 * * *" }] }
 *
 * Protected by CRON_SECRET env var.
 *
 * P-1: N+1 eliminated — owners and menu item counts are batch-fetched
 * before the loop instead of one query per restaurant.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret — reject if CRON_SECRET is not configured
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = authHeader.replace(/^Bearer\s+/i, "");
  // Use timing-safe comparison to prevent brute-force via timing side-channel
  if (
    !cronSecret ||
    secret.length !== cronSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(cronSecret))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let totalSent = 0;

  // Fetch all restaurants that haven't completed onboarding emails
  const { data: restaurants } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, slug, created_at, onboarding_emails_sent")
    .eq("is_active", true);

  if (!restaurants || restaurants.length === 0) return NextResponse.json({ sent: 0 });

  const restaurantIds = restaurants.map((r) => r.id);

  // Batch-fetch 1: all owners for these restaurants — replaces N per-restaurant queries
  const { data: owners } = await supabaseAdmin
    .from("users")
    .select("email, name, restaurant_id")
    .eq("role", "owner")
    .in("restaurant_id", restaurantIds);

  const ownerMap: Record<string, { email: string; name: string }> = {};
  for (const o of owners || []) {
    ownerMap[o.restaurant_id] = { email: o.email, name: o.name };
  }

  // Batch-fetch 2: menu item counts per restaurant — replaces N per-restaurant COUNT queries
  const { data: menuItems } = await supabaseAdmin
    .from("menu_items")
    .select("restaurant_id")
    .in("restaurant_id", restaurantIds);

  const menuCountMap: Record<string, number> = {};
  for (const m of menuItems || []) {
    menuCountMap[m.restaurant_id] = (menuCountMap[m.restaurant_id] || 0) + 1;
  }

  for (const r of restaurants) {
    const owner = ownerMap[r.id];
    if (!owner) continue;

    const createdAt = new Date(r.created_at);
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const emailsSent = (r.onboarding_emails_sent || {}) as Record<string, string>;
    let sent = 0; // per-restaurant counter

    // Day 0: Welcome email (same day as registration)
    if (daysSinceCreation >= 0 && !emailsSent.day0) {
      await sendEmail({
        to: owner.email,
        subject: `Welcome to OrderFlow, ${owner.name}! 🎉`,
        html: onboardingTemplate(
          escapeHtml(owner.name),
          "Welcome to OrderFlow!",
          `<p>Your restaurant <strong>${escapeHtml(r.name)}</strong> is all set up. Here's how to get started:</p>
          <ol style="color:#666;font-size:14px;line-height:1.8">
            <li><strong>Add your menu</strong> — categories and items with prices</li>
            <li><strong>Set opening hours</strong> — when customers can order</li>
            <li><strong>Configure delivery</strong> — fees and minimum orders</li>
            <li><strong>Connect Stripe</strong> — to receive payments</li>
          </ol>`,
          r.slug
        ),
      });
      emailsSent.day0 = now.toISOString();
      sent++;
    }

    // Day 3: Menu setup reminder — uses pre-fetched menuCountMap (no extra DB query)
    if (daysSinceCreation >= 3 && !emailsSent.day3) {
      const hasMenu = (menuCountMap[r.id] || 0) > 0;

      await sendEmail({
        to: owner.email,
        subject: hasMenu
          ? `Your menu is looking great! Next steps for ${r.name}`
          : `Quick reminder: Add your menu to ${r.name}`,
        html: onboardingTemplate(
          escapeHtml(owner.name),
          hasMenu ? "Great progress!" : "Add your menu",
          hasMenu
            ? `<p>You've already added menu items — nice work! Make sure to:</p>
              <ul style="color:#666;font-size:14px;line-height:1.8">
                <li>Set your opening hours</li>
                <li>Configure delivery fees</li>
                <li>Add allergen information to items</li>
                <li>Connect your Stripe account to go live</li>
              </ul>`
            : `<p>Your restaurant is set up but you haven't added any menu items yet.
              Adding your menu takes just a few minutes — customers can start ordering as soon as you're ready!</p>`,
          r.slug
        ),
      });
      emailsSent.day3 = now.toISOString();
      sent++;
    }

    // Day 7: Go live encouragement
    if (daysSinceCreation >= 7 && !emailsSent.day7) {
      await sendEmail({
        to: owner.email,
        subject: `Ready to go live? Your trial has 7 days left ⏰`,
        html: onboardingTemplate(
          escapeHtml(owner.name),
          "Time to go live!",
          `<p>You've had a week to set up <strong>${escapeHtml(r.name)}</strong>.
          Your free trial has 7 days remaining — now's the perfect time to:</p>
          <ol style="color:#666;font-size:14px;line-height:1.8">
            <li>Share your ordering link with customers</li>
            <li>Add the link to your Google Business listing</li>
            <li>Print a QR code for your shop counter</li>
            <li>Post on social media</li>
          </ol>
          <p style="color:#666;font-size:14px">Your ordering link: <strong>orderflow.co.uk/${r.slug}</strong></p>`,
          r.slug
        ),
      });
      emailsSent.day7 = now.toISOString();
      sent++;
    }

    // Update emails_sent tracking only if emails were sent for this restaurant
    if (sent > 0) {
      await supabaseAdmin
        .from("restaurants")
        .update({ onboarding_emails_sent: emailsSent })
        .eq("id", r.id);
      totalSent += sent;
    }
  }

  return NextResponse.json({ sent: totalSent });
}

function onboardingTemplate(name: string, title: string, content: string, slug: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f5f5f5">
<div style="max-width:500px;margin:0 auto;padding:20px">
<div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<div style="background:#1B4F72;padding:24px;text-align:center">
  <h1 style="color:white;margin:0;font-size:20px">${title}</h1>
</div>
<div style="padding:24px">
  <p style="margin:0 0 16px;color:#666;font-size:14px">Hi ${name},</p>
  ${content}
  <div style="margin-top:24px;text-align:center">
    <a href="https://orderflow.co.uk/dashboard" style="display:inline-block;background:#1B4F72;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
      Go to Dashboard →
    </a>
  </div>
</div>
<div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:12px;color:#999">
  Powered by OrderFlow
</div>
</div></div></body></html>`;
}
