import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cached } from "@/lib/cache";

/**
 * GET /api/manifest/[slug]
 * Returns a restaurant-specific PWA manifest.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;

  const restaurant = await cached(`manifest:${slug}`, 600, async () => {
    const { data } = await supabaseAdmin
      .from("restaurants")
      .select("name, slug, logo_url, brand_colour")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    return data;
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const themeColour = restaurant.brand_colour || "#1B4F72";
  const name = restaurant.name || "OrderFlow";

  const manifest = {
    name: `Order from ${name}`,
    short_name: name,
    description: `Order food directly from ${name}`,
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColour,
    icons: [
      {
        src: restaurant.logo_url || "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: restaurant.logo_url || "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=600",
    },
  });
}
