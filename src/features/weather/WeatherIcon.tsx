import { createElement } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";

/** Picks an icon from NWS wording ("Chance Showers And Thunderstorms", "Mostly Sunny", ...). */
export function iconFor(short: string, isDay: boolean): LucideIcon {
  const s = short.toLowerCase();
  if (s.includes("thunder")) return CloudLightning;
  if (/snow|sleet|flurr|ice|freezing/.test(s)) return CloudSnow;
  if (/rain|shower|drizzle/.test(s)) return CloudRain;
  if (/fog|haze|smoke|dust/.test(s)) return CloudFog;
  if (s.includes("wind") || s.includes("breezy")) return Wind;
  if (/partly|mostly sunny|mostly clear/.test(s))
    return isDay ? CloudSun : CloudMoon;
  if (s.includes("cloud") || s.includes("overcast")) return Cloud;
  return isDay ? Sun : Moon;
}

export function WeatherIcon({
  short,
  isDay,
  className = "",
}: {
  short: string;
  isDay: boolean;
  className?: string;
}) {
  // Every icon is a module-level component; this only picks one.
  return createElement(iconFor(short, isDay), {
    className,
    "aria-hidden": true,
  });
}
