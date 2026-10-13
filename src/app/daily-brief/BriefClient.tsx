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
        <h2 className="display text-2xl text-accent">Delivery</h2>
        <Card>
          <BriefSettings {...props} timeZone={tz} />
        </Card>
      </section>
    </div>
  );
}
