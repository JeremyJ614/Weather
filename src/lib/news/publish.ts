/** Turns the editor's publish choice into stored fields. Pure, so it is tested alone. */
export type Mode = "draft" | "now" | "schedule";

export function publishFields(
  mode: Mode,
  scheduleIso: string,
  existing: { status: string; publish_at: string | null } | null,
  now = new Date(),
):
  | { status: "draft" | "published"; publish_at: string | null }
  | { error: string } {
  if (mode === "draft") return { status: "draft", publish_at: null };
  if (mode === "now") {
    const keep =
      existing?.status === "published" &&
      existing.publish_at &&
      Date.parse(existing.publish_at) <= now.getTime();
    return {
      status: "published",
      publish_at: keep ? existing.publish_at : now.toISOString(),
    };
  }
  const t = Date.parse(scheduleIso);
  if (Number.isNaN(t)) return { error: "Pick a date and time to publish." };
  if (t <= now.getTime())
    return { error: "Pick a time in the future, or publish now." };
  if (t > now.getTime() + 366 * 86400000)
    return { error: "Schedule within the next year." };
  return { status: "published", publish_at: new Date(t).toISOString() };
}

export function postState(
  p: { status: string; publish_at: string | null },
  now = Date.now(),
) {
  if (p.status === "draft" || !p.publish_at) return "Draft";
  return Date.parse(p.publish_at) > now ? "Scheduled" : "Published";
}
