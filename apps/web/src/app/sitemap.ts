import { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://orderflow.co.uk";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/help`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/partners`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/status`, lastModified: new Date(), changeFrequency: "always", priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ];

  // Dynamic restaurant pages
  const { data: restaurants } = await supabaseAdmin
    .from("restaurants")
    .select("slug, updated_at")
    .eq("is_active", true)
    .eq("holiday_mode", false);

  const restaurantPages: MetadataRoute.Sitemap = (restaurants || []).map((r) => ({
    url: `${baseUrl}/${r.slug}`,
    lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...restaurantPages];
}
