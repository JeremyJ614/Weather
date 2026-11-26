"use client";

import dynamic from "next/dynamic";
import type { CountyCard } from "./share";

const MotionShare = dynamic(() => import("@/features/share/MotionShare"), {
  ssr: false,
});

/** "Share county card": the county, its paths and its record as one picture. */
export function ShareCounty({ data }: { data: CountyCard }) {
  return (
    <MotionShare
      file={`sswx-tornadoes-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${data.st.toLowerCase()}`}
      frames={1}
      formats={["image"]}
      label="Share county card"
      heading="Your county card"
      build={async (_f, progress) => {
        progress(0, 1);
        const { makeCountyCard } = await import("./share");
        return makeCountyCard(data);
      }}
    />
  );
}
