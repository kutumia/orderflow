import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { CookieConsent } from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: {
    default: "OrderFlow — Restaurant Online Ordering Platform",
    template: "%s",
  },
  description:
    "Stop paying delivery apps 30%. Own your customers. Keep your profits. Online ordering for UK independent restaurants.",
  keywords: [
    "restaurant ordering system",
    "online ordering",
    "UK restaurants",
    "takeaway ordering",
    "Just Eat alternative",
    "Deliveroo alternative",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://orderflow.co.uk"),
  openGraph: {
    title: "OrderFlow — Restaurant Online Ordering",
    description: "Stop paying delivery apps 30%. Online ordering for UK independent restaurants.",
    siteName: "OrderFlow",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OrderFlow — Restaurant Online Ordering",
    description: "Stop paying delivery apps 30%. Online ordering for UK independent restaurants.",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: "#6d28d9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  );
}
