import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";

/**
 * GET /api/table-qr?tables=20
 * Returns table QR code URLs for tables 1-N.
 */
export async function GET(req: NextRequest) {
  const guard = await requireSession(req);
  if (!guard.ok) return guard.response;

  const sessionUser = guard.session.user as any;
  const { searchParams } = new URL(req.url);
  const tableCount = Math.min(parseInt(searchParams.get("tables") || "20"), 50);
  const slug = sessionUser.restaurant_slug;
  const baseUrl = process.env.NEXTAUTH_URL || "https://orderflow.co.uk";

  const tables = Array.from({ length: tableCount }, (_, i) => {
    const tableNum = i + 1;
    const orderUrl = `${baseUrl}/${slug}?table=${tableNum}&type=dine_in`;
    // Use Google Charts QR API (no server-side dependency)
    const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${encodeURIComponent(orderUrl)}&choe=UTF-8`;
    return {
      table_number: tableNum,
      order_url: orderUrl,
      qr_url: qrUrl,
    };
  });

  return NextResponse.json({
    restaurant: sessionUser.restaurant_name,
    slug,
    tables,
  });
}
