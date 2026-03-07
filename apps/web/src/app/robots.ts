import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://orderflow.co.uk";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/kitchen/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
