import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "production" ||
      process.env.VERCEL === "1";
    const apiTarget = process.env.INTERNAL_API_URL || process.env.API_BASE_URL;

    if (isProd && (!apiTarget || !apiTarget.startsWith("https://"))) {
      // In production without an explicit HTTPS internal API, do not create loopback rewrites
      return [];
    }

    const resolved = (
      apiTarget ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:4000"
    ).replace(/\/+$/, "");

    return [
      {
        source: "/api-proxy/:path*",
        destination: `${resolved}/:path*`,
      },
    ];
  },
};

export default nextConfig;
