import states from "@/lib/map/data/usStatesAlbers.json";
import nation from "@/lib/map/data/usNationAlbers.json";
import { STATE_ABBR, US_STATE_LABELS } from "@/lib/map/usAlbersLabels";

export const dynamic = "force-static";

/** The national base map (pre-projected states and outline). Never changes. */
export function GET() {
  return Response.json(
    {
      states: (states as { states: { name: string; d: string }[] }).states.map(
        (s) => ({ id: STATE_ABBR[s.name] ?? s.name, d: s.d }),
      ),
      nation: (nation as { nation: string }).nation,
      labels: US_STATE_LABELS,
    },
    { headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
