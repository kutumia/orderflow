import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

/**
 * GET /api/shopify — entry point for Shopify OAuth install flow.
 *
 * When a merchant clicks "Install" in the Shopify App Store,
 * Shopify redirects them here with ?shop=xxx&hmac=xxx&timestamp=xxx.
 * We validate the HMAC and redirect to Shopify's OAuth consent screen.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");
  const hmac = searchParams.get("hmac");
  const timestamp = searchParams.get("timestamp");

  if (!shop || !hmac) {
    return NextResponse.json({ error: "Missing shop or hmac parameter" }, { status: 400 });
  }

  // Validate shop format
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
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

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(computedHmac))) {
    return NextResponse.json({ error: "HMAC validation failed" }, { status: 401 });
  }

  // Build OAuth consent URL
  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = "read_products,write_content,read_orders,write_draft_orders";
  const redirectUri = `${process.env.NEXTAUTH_URL || "https://orderflow.co.uk"}/api/shopify/callback`;

  // Generate nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString("hex");

  // Store nonce temporarily (in production, use Redis/DB with TTL)
  await supabaseAdmin.from("shopify_nonces").upsert({
    shop,
    nonce,
    created_at: new Date().toISOString(),
  }, { onConflict: "shop" });

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  return NextResponse.redirect(authUrl);
}
