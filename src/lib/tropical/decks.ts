import "server-only";
import { gunzipSync } from "node:zlib";
import { parseA, parseB, type Best, type Row } from "./atcf";

const ATCF = "https://ftp.nhc.noaa.gov/atcf";

/** A storm's roster rows (a-deck) and best track (b-deck). Callers cache their small results. */
export async function loadDecks(
  id: string,
): Promise<{ rows: Row[]; best: Map<string, Best> }> {
  const [a, b] = await Promise.all([
    fetch(`${ATCF}/aid_public/a${id}.dat.gz`, { cache: "no-store" }),
    fetch(`${ATCF}/btk/b${id}.dat`, { cache: "no-store" }),
  ]);
  if (!a.ok) throw new Error("a-deck");
  return {
    rows: parseA(
      gunzipSync(Buffer.from(await a.arrayBuffer())).toString("utf8"),
    ),
    best: parseB(b.ok ? await b.text() : ""),
  };
}
