import type { AnyMap } from "./WeatherMap";

/**
 * The live map as a titled PNG, in the static maps' style (owner, 2026-11-13: every map can
 * be downloaded or shared). The canvas is read inside a render pass, so no
 * preserveDrawingBuffer is needed.
 */
export async function mapPng(map: AnyMap, title: string): Promise<Blob> {
  const shot = await new Promise<HTMLCanvasElement>((ok) => {
    (map as { once: (e: string, f: () => void) => void }).once("render", () => {
      const src = map.getCanvas();
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      c.getContext("2d")!.drawImage(src, 0, 0);
      ok(c);
    });
    map.triggerRepaint();
  });
  const css = getComputedStyle(document.documentElement);
  const font = getComputedStyle(document.body).fontFamily;
  const k = shot.width / Math.max(1, map.getCanvas().clientWidth);
  const band = 80 * k;
  const foot = 30 * k;
  const c = document.createElement("canvas");
  c.width = shot.width;
  c.height = shot.height + band + foot;
  const g = c.getContext("2d")!;
  g.fillStyle = css.getPropertyValue("--bg").trim() || "#0b0c14";
  g.fillRect(0, 0, c.width, c.height);
  g.scale(k, k);
  g.fillStyle = css.getPropertyValue("--accent").trim() || "#d9b76f";
  g.font = `700 12px ${font}`;
  g.fillText("SSWX WEATHER CENTER", 18, 28);
  g.fillStyle = "#fff";
  g.font = `800 22px ${font}`;
  g.fillText(title, 18, 56, c.width / k - 36);
  g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
  g.font = `500 12px ${font}`;
  g.fillText(new Date().toLocaleString(), 18, 72);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(shot, 0, band);
  g.scale(k, k);
  g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
  g.font = `600 11px ${font}`;
  g.fillText("weather.sswx.space", 18, (c.height - 10 * k) / k);
  return new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );
}

/** Share the image where the phone can, else download it. */
export async function saveOrShare(
  blob: Blob,
  name: string,
  title: string,
  share: boolean,
) {
  const f = new File([blob], `${name}.png`, { type: "image/png" });
  if (share && navigator.canShare?.({ files: [f] })) {
    await navigator.share({
      files: [f],
      title,
      url: location.href.split("#")[0],
    });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
