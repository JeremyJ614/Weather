"use client";

import { useState } from "react";
import { Thermometer } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { UsMap } from "@/features/maps/UsMap";
import { Picker, Section } from "@/features/maps/Section";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { CPC } from "@/lib/map/products";
import s from "./CpcPanel.module.css";

/** CPC subtab: 6–10 and 8–14 day, monthly, seasonal and drought outlooks on a static national map. */
export function CpcPanel() {
  const [pick, setPick] = useState(CPC[0].id);
  const { layer, status } = useLayer(pick);
  return (
    <div className="grid gap-6">
      <Section
        icon={<Thermometer aria-hidden />}
        eyebrow="Climate Prediction Center"
        title="Outlooks: the weeks and months ahead"
        note="These are odds, not forecasts of an amount. Each color is the chance that the period ends up above, near or below normal. Where no side is favored the map is left plain: equal chances."
      >
        <Picker>
          {CPC.map((x) => (
            <Chip
              key={x.id}
              pressed={x.id === pick}
              onClick={() => setPick(x.id)}
            >
              {x.label}
            </Chip>
          ))}
        </Picker>
        <UsMap
          title={layer?.title ?? "Climate outlook"}
          sub={layer?.valid}
          legend={layer?.legend ?? []}
          status={status}
          file={`sswx-cpc-${pick}`}
        >
          {layer && <Polys polys={layer.polys} />}
        </UsMap>
      </Section>
      <div className={s.learn}>
        <div>
          <b>33%</b>
          <p>Normal odds. Each of the three outcomes is equally likely.</p>
        </div>
        <div>
          <b>50%+</b>
          <p>
            A real lean: one outcome is now as likely as the other two together.
          </p>
        </div>
        <div>
          <b>70%+</b>
          <p>Strong confidence. Rare, and worth planning around.</p>
        </div>
      </div>
    </div>
  );
}
