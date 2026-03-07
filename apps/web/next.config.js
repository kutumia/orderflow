const { withSentryConfig } = require("@sentry/nextjs");

// Bundle analyzer: run with ANALYZE=true npm run build
const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? require("@next/bundle-analyzer")({ enabled: true })
  : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orderflow/database", "@orderflow/security", "@orderflow/printbridge-core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    // Serve optimised images via Next.js Image component
    formats: ["image/webp"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Headers for caching static assets and enforcing security
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" }
        ]
      },
      {
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/api/restaurants",
        headers: [{ key: "Cache-Control", value: "s-maxage=120, stale-while-revalidate=300" }],
      },
    ];
  },
};

// Only wrap with Sentry in production when DSN is set
const sentryEnabled =
  process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production";

module.exports = sentryEnabled
  ? withBundleAnalyzer(withSentryConfig(nextConfig, {
      // Sentry webpack plugin options
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    },
    {
      // Sentry SDK options
      widenClientFileUpload: true,
      transpileClientSDK: true,
      hideSourceMaps: true,
      disableLogger: true,
    }))
  : withBundleAnalyzer(nextConfig);
