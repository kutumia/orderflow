import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

/**
 * GET /api/shopify/callback — Shopify redirects here after merchant approves OAuth.
 *
 * Exchanges the temporary code for a permanent access token,
 * stores the shop's credentials, and redirects to embedded app UI.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");

  if (!shop || !code || !state) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  // Validate HMAC
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const params = new URLSearchParams(searchParams);
  params.delete("hmac");
  params.sort();
  const message = params.toString();
  const computedHmac = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");

  // [P1 FIX] Previously `if (hmac && ...)` — when hmac was absent the check was
  // silently skipped. Now we require hmac to be present AND correct.
  if (!hmac || !crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(computedHmac))) {
    return NextResponse.json({ error: "HMAC validation failed" }, { status: 401 });
  }

  // Validate nonce (CSRF protection) — must match AND be less than 15 minutes old.
  // Without TTL an attacker who intercepts an old valid nonce can replay it indefinitely.
  const nonceCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: nonceRecord } = await supabaseAdmin
    .from("shopify_nonces")
    .select("nonce, created_at")
    .eq("shop", shop)
    .gt("created_at", nonceCutoff)
    .single();

  if (!nonceRecord || nonceRecord.nonce !== state) {
    return NextResponse.json({ error: "Invalid or expired state parameter" }, { status: 401 });
  }

  // Clean up nonce immediately after validation (one-time use)
  await supabaseAdmin.from("shopify_nonces").delete().eq("shop", shop);

  // Exchange code for permanent access token
  const apiKey = process.env.SHOPIFY_API_KEY;
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const scope = tokenData.scope;

  // Store shop credentials
  await supabaseAdmin.from("shopify_shops").upsert({
    shop,
    access_token: accessToken,
    scope,
    installed_at: new Date().toISOString(),
    is_active: true,
  }, { onConflict: "shop" });

  // Redirect to embedded app settings page
  const baseUrl = process.env.NEXTAUTH_URL || "https://orderflow.co.uk";
  const appUrl = `https://${shop}/admin/apps/${apiKey}`;

  return NextResponse.redirect(appUrl);
}
