"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { snap } from "@/lib/weather/geo";
import {
  MAX_PLACES,
  addPlace,
  read,
  removePlace,
  setActive,
  write,
  type Place,
} from "./store";
import { usePlaces } from "./usePlaces";
import { PlaceSearch } from "./PlaceSearch";
import s from "./LocationSheet.module.css";

type Msg = { text: string; error?: boolean } | null;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body as T;
}

function save(p: Omit<Place, "id">): Msg {
  const next = addPlace(read(), p);
  if (!next)
    return {
      text: `You have ${MAX_PLACES} places. Remove one to add another.`,
      error: true,
    };
  write(next);
  return null;
}

/** Bottom sheet to add, switch and remove saved places. */
export function LocationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { places } = usePlaces();
  const [busy, setBusy] = useState<"gps" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const full = places.list.length >= MAX_PLACES;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const done = (m: Msg) => {
    setBusy(null);
    setMsg(m);
    if (!m) onClose();
  };

  const useGps = () => {
    if (!("geolocation" in navigator)) {
      setMsg({
        text: "This device can't share its location. Search for your city or ZIP instead.",
        error: true,
      });
      return;
    }
    setBusy("gps");
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const [lat, lon] = snap(pos.coords.latitude, pos.coords.longitude);
        try {
          const w = await getJson<{ place: { label: string } }>(
            `/api/weather?lat=${lat}&lon=${lon}`,
          );
          done(save({ label: w.place.label, lat, lon, source: "gps" }));
        } catch (e) {
          done({ text: (e as Error).message, error: true });
        }
      },
      (err) =>
        done({
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked for this site. Turn it on in your browser or phone settings, or search for your city or ZIP."
              : "Your location couldn't be found. Try again, or search for your city or ZIP.",
          error: true,
        }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  };

  return (
    <dialog
      ref={ref}
      className={s.sheet}
      onClose={onClose}
      aria-labelledby="loc-title"
    >
      <div className={s.body}>
        <div className={s.grip} aria-hidden />
        <div className="flex items-center justify-between">
          <h2 id="loc-title" className="display text-2xl text-accent">
            Your places
          </h2>
          <button className={s.remove} onClick={onClose} aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {places.list.length > 0 && (
          <ul className="grid gap-2">
            {places.list.map((p) => (
              <li key={p.id} className={s.place}>
                <button
                  className={s.pick}
                  aria-current={p.id === places.active}
                  onClick={() => {
                    write(setActive(read(), p.id));
                    onClose();
                  }}
                >
                  {p.source === "gps" ? (
                    <Crosshair className="size-4" aria-hidden />
                  ) : (
                    <MapPin className="size-4" aria-hidden />
                  )}
                  {p.label}
                </button>
                <button
                  className={s.remove}
                  onClick={() => write(removePlace(read(), p.id))}
                  aria-label={`Remove ${p.label}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {full ? (
          <p className={s.msg}>
            You have {MAX_PLACES} places. Remove one to add another.
          </p>
        ) : (
          <>
            <PlaceSearch
              disabled={busy !== null}
              onPick={(p) => {
                const [lat, lon] = snap(p.lat, p.lon);
                done(
                  save({
                    label: p.label,
                    lat,
                    lon,
                    source: p.zip ? "zip" : "search",
                  }),
                );
              }}
            />
            <div className="grid gap-2">
              <Button
                variant="primary"
                onClick={useGps}
                disabled={busy !== null}
              >
                <Crosshair className="size-4" aria-hidden />
                {busy === "gps" ? "Finding you…" : "Use my location"}
              </Button>
              <p className={s.msg}>
                Used once to find your forecast. Only an area about a mile wide
                is saved, on this device.
              </p>
            </div>
          </>
        )}
        {msg && (
          <p className={s.msg} data-error={msg.error} role="status">
            {msg.text}
          </p>
        )}
      </div>
    </dialog>
  );
}
