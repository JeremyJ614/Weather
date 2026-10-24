"use server";

import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fillReport } from "@/lib/engines/reports";

export type ReportKind = "rainbow" | "sunset" | "fish" | "deer";
const KINDS: ReportKind[] = ["rainbow", "sunset", "fish", "deer"];

/**
 * A member's sighting for an outdoor engine (a rainbow, a sunset's stars, a catch, deer seen),
 * with an optional photo already in their own folder. The engine's inputs at that place and
 * time are filled in afterwards, for checking and tuning it.
 */
export async function sendReport(r: {
  kind: string;
  lat: number;
  lon: number;
  rating?: number | null;
  detail?: string;
  photo?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const kind = r.kind as ReportKind;
  if (!KINDS.includes(kind)) return { error: "Unknown report." };
  const lat = Number(r.lat);
  const lon = Number(r.lon);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180))
    return { error: "Your location didn't come through." };
  const max = kind === "sunset" ? 5 : 99;
  const rating =
    kind === "rainbow" ? null : Math.round(Number(r.rating ?? NaN));
  if (
    rating !== null &&
    !(rating >= (kind === "sunset" ? 1 : 0) && rating <= max)
  )
    return {
      error: kind === "sunset" ? "Pick 1 to 5 stars." : "Enter how many.",
    };
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Sign in to send a report." };
  const photo = r.photo ?? null;
  if (photo && !new RegExp(`^${user.id}/\\d+\\.(jpg|webp)$`).test(photo))
    return { error: "That photo didn't upload. Try again." };
  const { count } = await sb
    .from("outdoor_reports")
    .select("id", { count: "exact", head: true })
    .gt("created_at", new Date(Date.now() - 86400_000).toISOString());
  if ((count ?? 0) >= 20)
    return { error: "That's 20 reports today. Thanks! Send more tomorrow." };
  const at = new Date();
  const { data, error } = await sb
    .from("outdoor_reports")
    .insert({
      user_id: user.id,
      kind,
      at: at.toISOString(),
      lat,
      lon,
      rating,
      detail: String(r.detail ?? "").slice(0, 40),
      photo,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't save it. Try again." };
  after(() =>
    fillReport(data.id, kind, lat, lon, at.getTime(), String(r.detail ?? "")),
  );
  return { ok: true };
}
