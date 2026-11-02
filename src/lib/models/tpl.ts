/** A model file's address from its template ({d} date, {h} cycle hour, {f2}/{f3} hour). */
export const fill = (tpl: string, d: string, h: string, f: number) =>
  tpl
    .replaceAll("{d}", d)
    .replaceAll("{h}", h)
    .replaceAll("{f2}", String(f).padStart(2, "0"))
    .replaceAll("{f3}", String(f).padStart(3, "0"));
