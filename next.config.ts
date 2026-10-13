import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off until measured against the performance budget (it adds shared JS).
  reactCompiler: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
