"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Crosshair, MapPin } from "lucide-react";
import { usePlaces } from "./usePlaces";
import { LocationSheet } from "./LazyLocationSheet";
import s from "./HeaderLocation.module.css";

/**
 * The place every page is reading, in the header (Fix list 2026-10-30 #6): one tap opens the
 * places sheet to switch between saved places, search a city or ZIP, or use GPS.
 */
export function HeaderLocation() {
  const { active } = usePlaces();
  const [open, setOpen] = useState(false);
  // Mounted on first use and kept, so it can slide closed.
  const [used, setUsed] = useState(false);
  const name = active?.label.replace(/, (USA|United States)$/, "");
  // The city alone fits beside the masthead on any phone; the full place is read aloud.
  const city = name?.split(",")[0];
  return (
    <div className={s.wrap}>
      <button
        type="button"
        className={s.chip}
        aria-haspopup="dialog"
        aria-label={
          name ? `Your location: ${name}. Change it` : "Set your location"
        }
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
      >
        {name ? <MapPin aria-hidden /> : <Crosshair aria-hidden />}
        <span>{city ?? "Set location"}</span>
      </button>
      {used &&
        createPortal(
          <LocationSheet open={open} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </div>
  );
}
