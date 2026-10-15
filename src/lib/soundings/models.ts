/** Model soundings offered (IEM BUFKIT model ids). */
export const MODELS = [
  {
    id: "HRRR",
    label: "HRRR",
    desc: "3 km, hourly runs, 18 h (48 h at 00/06/12/18Z)",
  },
  { id: "RAP", label: "RAP", desc: "13 km, hourly runs, 21–51 h" },
  { id: "NAM4KM", label: "NAM 3 km", desc: "3 km nest, 4 runs a day, 60 h" },
  { id: "NAM", label: "NAM", desc: "12 km, 4 runs a day, 84 h" },
  { id: "GFS", label: "GFS", desc: "Global, 4 runs a day, 7.5 days" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];
