import type { Metadata, Viewport } from "next";
import { Mulish, Playfair_Display } from "next/font/google";
import "./globals.css";
import { DeviceSetup } from "@/components/DeviceSetup";

const body = Mulish({ subsets: ["latin"], variable: "--font-body" });
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "StormSync Media",
  applicationName: "StormSync Media",
  appleWebApp: {
    capable: true,
    title: "StormSync",
    statusBarStyle: "black-translucent",
  },
  description:
    "Severe weather, forecasts and storm chasing from StormSync Media.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c14",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <DeviceSetup />
        {children}
      </body>
    </html>
  );
}
