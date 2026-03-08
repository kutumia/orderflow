import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { log } from "@/lib/logger";
import crypto from "crypto";

/**
 * POST /api/shopify/webhooks
 * Handles Shopify webhook notifications (app/uninstalled, etc.).
 * HMAC verification is mandatory — requests without a valid signature are rejected.
 */
export async function POST(req: NextRequest) {
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");

  const rawBody = await req.text();

  // HMAC verification is mandatory — reject if secret is not configured
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    log.error("SHOPIFY_API_SECRET is not configured — cannot verify webhook");
    return NextResponse.json({ error: "Webhook verification not configured" }, { status: 500 });
  }

  if (!hmac) {
    return NextResponse.json({ error: "Missing HMAC signature" }, { status: 401 });
  }

  const computedHmac = crypto
    .createHmac("sha256", apiSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(computedHmac))) {
    log.warn("Shopify webhook HMAC verification failed", { shop, topic });
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  // Handle different webhook topics
  switch (topic) {
    case "app/uninstalled":
      if (shop) {
        await supabaseAdmin
          .from("shopify_shops")
          .update({
            is_active: false,
            access_token: null,
            uninstalled_at: new Date().toISOString(),
          })
          .eq("shop", shop);
        log.info("Shopify app uninstalled", { shop });
      }
      break;

    default:
      log.debug("Unhandled Shopify webhook topic", { topic, shop });
  }

  return NextResponse.json({ received: true });
}
