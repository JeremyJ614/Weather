"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/Card";
import { BriefSettings } from "./BriefSettings";
import { BriefView } from "./BriefView";

type Props = Omit<Parameters<typeof BriefSettings>[0], "timeZone">;

/** The brief and its delivery settings share the place's time zone. */
export function BriefClient(props: Props) {
  const [tz, setTz] = useState<string | null>(null);
  const onTz = useCallback((t: string) => setTz(t), []);
  return (
    <div className="grid gap-6">
      <BriefView onTimeZone={onTz} />
      <section id="settings" className="grid gap-3">
        <div>
          <p className="eyebrow">Delivery</p>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            Get it every morning
          </h2>
        </div>
        <Card>
          <BriefSettings {...props} timeZone={tz} />
        </Card>
      </section>
    </div>
  );
}
