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
  expect(
    parseAfd(".OUN WATCHES/WARNINGS/ADVISORIES...\nNone.\n")[0].title,
  ).toBe("Watches, warnings & advisories");
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

import { officeName, rawBlocks } from "@/lib/afd/raw";

it("keeps the official text verbatim in display blocks", () => {
  const text = `000\nFXUS61 KILN 131018\nAFDILN\n\nArea Forecast Discussion\nNational Weather Service Wilmington OH\n618 AM EDT Tue Oct 13 2026\n\n.SYNOPSIS...\nWarm and dry today.\n  Storms tonight.\n\n&&\n\n.AVIATION /12Z THROUGH 12Z/...\nVFR.\n\n$$\n\nSYNOPSIS...Smith\n`;
  const b = rawBlocks(text);
  expect(b.map((x) => x.kind)).toEqual(["head", "section", "section", "sign"]);
  expect(b[1].lines).toEqual([
    ".SYNOPSIS...",
    "Warm and dry today.",
    "  Storms tonight.",
    "",
    "&&",
  ]);
  expect(b[2].title).toBe("AVIATION /12Z THROUGH 12Z/");
  expect(b[3].lines.at(-1)).toBe("SYNOPSIS...Smith");
  expect(officeName(text)).toBe("Wilmington OH");
});
