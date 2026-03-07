import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";

interface Props {
  params: { slug: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("name, slug, description, logo_url, banner_url, address")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .single();

  if (!restaurant) {
    return {
      title: "Restaurant Not Found — OrderFlow",
      description: "This restaurant could not be found.",
    };
  }

  const title = `${restaurant.name} — Order Online | OrderFlow`;
  const description =
    restaurant.description ||
    `Order food online from ${restaurant.name} for delivery or collection. Fast, easy, no app needed.`;
  const ogImage = restaurant.banner_url || restaurant.logo_url || null;

  // Build base URL from env or fallback
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://orderflow.co.uk";
  const url = `${baseUrl}/${restaurant.slug}`;

  return {
    title,
    description,
    keywords: [
      restaurant.name,
      "order food online",
      "takeaway",
      "delivery",
      "collection",
      restaurant.address || "",
      "OrderFlow",
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      url,
      siteName: "OrderFlow",
      type: "website",
      locale: "en_GB",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: restaurant.name }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function SlugLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  return (
    <>
      <link rel="manifest" href={`/api/manifest/${params.slug}`} />
      <PwaRegistration />
      <JsonLdScript slug={params.slug} />
      {children}
    </>
  );
}

function PwaRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`
      }}
    />
  );
}

async function JsonLdScript({ slug }: { slug: string }) {
  const { data: restaurant } = await supabaseAdmin
    .from("restaurants")
    .select("name, slug, description, logo_url, address, phone, email, delivery_enabled, collection_enabled")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!restaurant) return null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://orderflow.co.uk";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    url: `${baseUrl}/${restaurant.slug}`,
    ...(restaurant.description ? { description: restaurant.description } : {}),
    ...(restaurant.logo_url ? { image: restaurant.logo_url } : {}),
    ...(restaurant.address ? { address: { "@type": "PostalAddress", streetAddress: restaurant.address } } : {}),
    ...(restaurant.phone ? { telephone: restaurant.phone } : {}),
    ...(restaurant.email ? { email: restaurant.email } : {}),
    ...(restaurant.delivery_enabled || restaurant.collection_enabled
      ? {
          potentialAction: {
            "@type": "OrderAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${baseUrl}/${restaurant.slug}`,
              actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
            },
            deliveryMethod: [
              ...(restaurant.delivery_enabled ? ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"] : []),
              ...(restaurant.collection_enabled ? ["http://purl.org/goodrelations/v1#DeliveryModePickUp"] : []),
            ],
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
