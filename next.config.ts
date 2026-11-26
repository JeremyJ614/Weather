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
  // The Tornado Database (scripts/tornado_db.py) is read from disk by these routes.
  outputFileTracingIncludes: {
    "/severe-weather-history": ["./src/data/tornado/index.json"],
    "/severe-weather-history/tornado-database/*": ["./src/data/tornado/**/*"],
    "/api/tornado/*": ["./src/data/tornado/**/*"],
  },
  // The Tornado Database is Severe Weather History's third tab (owner, 2026-11-26).
  async redirects() {
    return [
      {
        source: "/tornado-database",
        destination: "/severe-weather-history#tornado-database",
        permanent: true,
      },
      {
        source: "/severe-weather-history/tornado-database",
        destination: "/severe-weather-history#tornado-database",
        permanent: true,
      },
      {
        source: "/tornado-database/:county",
        destination: "/severe-weather-history/tornado-database/:county",
        permanent: true,
      },
    ];
  },
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
      {
        // The hurricane history archive (scripts/build-tracks.py): rebuilt a few times a year,
        // so a week in the browser and the CDN, then checked again.
        source: "/extras/tracks/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
