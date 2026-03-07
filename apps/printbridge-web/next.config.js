/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orderflow/database", "@orderflow/security", "@orderflow/printbridge-core"],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;
