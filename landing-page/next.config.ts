import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdf.js memuat modul 'canvas' hanya untuk Node; di browser tidak dipakai.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "ubsi-api.muaraai.com",
          },
        ],
        destination: "https://mira.muaraai.com/:path*",
        permanent: true, // HTTP 308 Permanent Redirect
      },
    ];
  },
};

export default nextConfig;
