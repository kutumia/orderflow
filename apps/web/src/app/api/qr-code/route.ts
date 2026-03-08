import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";

/**
 * GET /api/qr-code?slug=xxx&size=400
 * Generates a QR code PNG for the restaurant's ordering URL.
 * Uses the Google Charts QR API (no dependency needed).
 */
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || (guard.session.user as any).restaurant_slug;
  const size = parseInt(searchParams.get("size") || "400");
  const clampedSize = Math.min(Math.max(size, 100), 1000);

  const orderUrl = `https://orderflow.co.uk/${slug}`;

  // Use Google Charts QR API for zero-dependency QR generation
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=${clampedSize}x${clampedSize}&chl=${encodeURIComponent(orderUrl)}&choe=UTF-8&chld=M|2`;

  return NextResponse.json({
    qr_url: qrUrl,
    order_url: orderUrl,
    slug,
    size: clampedSize,
  });
}
