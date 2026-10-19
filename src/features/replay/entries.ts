/** One row in the replay switcher: a famous event, an NWS-surveyed day, or a member's chase. */
export interface ReplayEntry {
  id: string;
  kind: "chase" | "archive";
  title: string;
  subtitle?: string;
  count?: number;
  strongest?: string;
  fatalities?: number;
  date?: string;
  blurb?: string;
  /** Archive rows only: added automatically from new NWS surveys. */
  auto?: boolean;
}
