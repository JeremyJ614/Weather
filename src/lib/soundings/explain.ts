import type { Analysis } from "./thermo";

/** A plain-language read of a sounding, two or three sentences. */
export function explain(a: Analysis): string {
  const out: string[] = [];
  const cape = a.ml.cape;
  const inst =
    cape < 100
      ? "Little instability"
      : cape < 1000
        ? "Modest instability"
        : cape < 2500
          ? "Strong instability"
          : "Extreme instability";
  const cap =
    cape >= 100 && a.ml.cin <= -100
      ? ", held under a strong cap"
      : cape >= 100 && a.ml.cin <= -25
        ? ", under a cap that has to break first"
        : "";
  out.push(`${inst} (mixed-layer CAPE ${cape} J/kg)${cap}.`);
  const s6 = a.shear6;
  if (s6 != null)
    out.push(
      s6 >= 35
        ? `Strong deep-layer shear (${s6} kt) supports supercells${cape < 100 ? " if storms can form" : ""}.`
        : s6 >= 20
          ? `Moderate shear (${s6} kt) organizes storms into lines and clusters.`
          : `Weak shear (${s6} kt): storms that form pulse up and rain out.`,
    );
  if ((a.stp ?? 0) >= 1)
    out.push(
      `Low-level spin (0–1 km SRH ${a.srh1}) with low cloud bases favors tornadoes (STP ${a.stp}).`,
    );
  else if ((a.srh1 ?? 0) >= 150 && cape >= 250)
    out.push(`Strong low-level spin (0–1 km SRH ${a.srh1} m²/s²).`);
  if (a.pwatIn >= 1.75)
    out.push(
      `Very moist column (${a.pwatIn} in of precipitable water): heavy rain where storms train.`,
    );
  return out.join(" ");
}
