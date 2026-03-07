import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret";

/**
 * Generate a signed unsubscribe token for a customer email.
 */
export function generateUnsubscribeToken(email: string, restaurantId: string): string {
  const payload = `${email}:${restaurantId}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").substring(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Verify and decode an unsubscribe token.
 */
function verifyToken(token: string): { email: string; restaurantId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    const sig = parts.pop()!;
    const restaurantId = parts.pop()!;
    const email = parts.join(":");
    const expected = crypto.createHmac("sha256", SECRET).update(`${email}:${restaurantId}`).digest("hex").substring(0, 16);
    if (sig !== expected) return null;
    return { email, restaurantId };
  } catch { return null; }
}

/**
 * GET /api/unsubscribe?token=xxx
 * Opts the customer out of marketing emails. Shows a simple confirmation page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse(htmlPage("Invalid Link", "This unsubscribe link is not valid."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const data = verifyToken(token);
  if (!data) {
    return new NextResponse(htmlPage("Invalid Link", "This unsubscribe link has expired or is not valid."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Opt out
  await supabaseAdmin
    .from("customers")
    .update({
      marketing_opt_out: true,
      marketing_opt_out_at: new Date().toISOString(),
    })
    .eq("restaurant_id", data.restaurantId)
    .eq("email", data.email);

  return new NextResponse(
    htmlPage("Unsubscribed", "You've been unsubscribed from marketing emails. You'll still receive order confirmations and receipts."),
    { headers: { "Content-Type": "text/html" } }
  );
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — OrderFlow</title>
<style>body{margin:0;padding:40px 20px;font-family:system-ui,sans-serif;background:#f5f5f5;display:flex;justify-content:center}
.card{background:white;border-radius:12px;padding:40px;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
h1{margin:0 0 12px;font-size:20px;color:#333}p{margin:0;font-size:14px;color:#666;line-height:1.5}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
