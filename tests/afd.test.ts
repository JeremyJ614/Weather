import { expect, it } from "vitest";
import { parseAfd } from "@/lib/afd/parse";

const sample = `000
FXUS64 KOUN 130645
AFDOUN

Area Forecast Discussion
National Weather Service Norman OK
145 AM CDT Tue Oct 13 2026

.KEY MESSAGES...

- Storms possible
  Wednesday night.

&&

.SHORT TERM...
(Today and tonight)
Issued at 140 AM CDT Tue Oct 13 2026

Warm and breezy today
with highs near 90.

Lows in the 70s.

&&

.AVIATION...
VFR.

&&

$$

SHORT TERM...04
`;

it("splits an AFD into readable sections", () => {
  const s = parseAfd(sample);
  expect(s.map((x) => x.title)).toEqual([
    "Key messages",
    "Short term",
    "Aviation",
  ]);
  expect(s[1].paragraphs).toEqual([
    "(Today and tonight) Issued at 140 AM CDT Tue Oct 13 2026",
    "Warm and breezy today with highs near 90.",
    "Lows in the 70s.",
  ]);
  expect(s[0].paragraphs[0]).toBe("- Storms possible Wednesday night.");
});
