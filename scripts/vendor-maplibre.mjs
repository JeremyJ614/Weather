// MapLibre v6 starts its tile worker from a URL next to its own module, which the bundler does
// not emit. Copy the worker (and the shared chunk it imports) into public/ under a versioned
// path; WeatherMap points setWorkerUrl at it. Runs before dev and build.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = join(import.meta.dirname, "..", "node_modules", "maplibre-gl");
const { version } = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
const out = join(
  import.meta.dirname,
  "..",
  "public",
  "vendor",
  "maplibre",
  version,
);
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(pkg, "dist", f), join(out, f));
}
console.log(
  `MapLibre ${version} worker copied to public/vendor/maplibre/${version}`,
);
