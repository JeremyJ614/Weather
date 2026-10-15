/** Sounding colors; every one is editable in admin → Map & data colors (`snd:*`). */
export const SND_LINES = [
  { key: "temp", label: "Temperature", color: "#f43f5e" },
  { key: "dew", label: "Dew point", color: "#22c55e" },
  { key: "parcel", label: "Lifted parcel", color: "#e5e7eb" },
  { key: "cape", label: "CAPE shading", color: "#f59e0b" },
  { key: "storm", label: "Storm motion", color: "#ffffff" },
];
/** Hodograph and 3D wind colors by height band (km AGL). */
export const SND_BANDS = [
  { key: "0-1", label: "0–1 km", top: 1000, color: "#f43f5e" },
  { key: "1-3", label: "1–3 km", top: 3000, color: "#f97316" },
  { key: "3-6", label: "3–6 km", top: 6000, color: "#22c55e" },
  { key: "6-9", label: "6–9 km", top: 9000, color: "#38bdf8" },
  { key: "9-12", label: "9–12 km", top: 12000, color: "#a78bfa" },
];
