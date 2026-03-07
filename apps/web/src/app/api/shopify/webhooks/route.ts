import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

/**
 * POST /api/shopify/webhooks
 * Handles Shopify webhook notifications (app/uninstalled, etc.).
 * Verifies HMAC signature for authenticity.
 */
export async function POST(req: NextRequest) {
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");

  const rawBody = await req.text();

  // Verify HMAC
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (apiSecret && hmac) {
    const computedHmac = crypto
      .createHmac("sha256", apiSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(computedHmac))) {
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }
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
      }
      break;

    default:
      // Log unhandled topics for monitoring
      console.log(`Unhandled Shopify webhook: ${topic} from ${shop}`);
  }

  return NextResponse.json({ received: true });
}
