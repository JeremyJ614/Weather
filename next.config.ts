import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/** The build stamp (scripts/build-id.mjs): open pages compare it with /version.json. */
let build = "dev";
try {
  build = JSON.parse(readFileSync("public/version.json", "utf8")).id ?? "dev";
} catch {}

const nextConfig: NextConfig = {
  env: { SSWX_BUILD: build },
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
      {
        // Versioned copies of third-party worker files (scripts/vendor-maplibre.mjs).
        source: "/vendor/:path*",
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
