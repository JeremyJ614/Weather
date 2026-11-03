import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "StormSync Media",
    short_name: "StormSync",
    description:
      "Severe weather, forecasts and storm chasing from StormSync Media.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c14",
    theme_color: "#0b0c14",
    categories: ["weather", "news", "education"],
    // Long-press the installed app's icon for these.
    shortcuts: [
      {
        name: "SSWXCon Score",
        url: "/sswxcon",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "SPC outlook",
        url: "/spc-probability",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Radar",
        url: "/radar-model-runs",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Warnings",
        url: "/warnings-reports",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
