/** Climate Prediction Center outlooks, served by NOAA's map services. */
export const CPC_OUTLOOKS = [
  {
    id: "610t",
    label: "6–10 day temp",
    service: "cpc_6_10_day_outlk",
    layer: 0,
    kind: "temp",
  },
  {
    id: "610p",
    label: "6–10 day precip",
    service: "cpc_6_10_day_outlk",
    layer: 1,
    kind: "precip",
  },
  {
    id: "814t",
    label: "8–14 day temp",
    service: "cpc_8_14_day_outlk",
    layer: 0,
    kind: "temp",
  },
  {
    id: "814p",
    label: "8–14 day precip",
    service: "cpc_8_14_day_outlk",
    layer: 1,
    kind: "precip",
  },
  {
    id: "mt",
    label: "Next month temp",
    service: "cpc_mthly_temp_outlk",
    layer: 0,
    kind: "temp",
  },
  {
    id: "mp",
    label: "Next month precip",
    service: "cpc_mthly_precip_outlk",
    layer: 0,
    kind: "precip",
  },
  {
    id: "st",
    label: "Next 3 months temp",
    service: "cpc_sea_temp_outlk",
    layer: 0,
    kind: "temp",
  },
  {
    id: "sp",
    label: "Next 3 months precip",
    service: "cpc_sea_precip_outlk",
    layer: 0,
    kind: "precip",
  },
  {
    id: "dr",
    label: "Drought outlook",
    service: "cpc_drought_outlk",
    layer: 0,
    kind: "drought",
  },
] as const;

export const CPC_LEGEND = {
  temp: "Reds: warmer than normal is favored. Blues: colder. Darker means more likely. White: equal chances.",
  precip:
    "Greens: wetter than normal is favored. Browns: drier. Darker means more likely. White: equal chances.",
  drought:
    "Where drought is expected to develop, persist, improve or end over the coming month.",
} as const;
