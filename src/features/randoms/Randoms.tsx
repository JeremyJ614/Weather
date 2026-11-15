"use client";

import { useState } from "react";
import {
  Bird,
  Droplet,
  Gem,
  Hourglass,
  Images,
  Orbit,
  Palette,
  Sparkles,
  Tornado,
  Waves,
  Telescope,
  Sunrise,
  Atom,
  MoonStar,
} from "lucide-react";
import {
  AuraScene,
  AuroraScene,
  FieldScene,
  FlockScene,
  GalaxyScene,
  HorizonScene,
  InkScene,
  MorphScene,
  OceanScene,
  OrbScene,
  SandScene,
  SliderScene,
  SpacetimeScene,
  StormScene,
} from "./Scenes";
import { useViewer } from "@/features/account/useViewer";
import { awaiting, stateOf, type ExtrasStates } from "@/lib/extras/items";
import s from "./Randoms.module.css";

const LIST = [
  {
    id: "storm",
    name: "Storm Visualizer",
    blurb:
      "A supercell, a tornado and a hurricane, built from up to 135,000 particles.",
    Icon: Tornado,
    C: StormScene,
  },
  {
    id: "slider",
    name: "The Weather Slider",
    blurb: "Real storm photos pouring into each other.",
    Icon: Images,
    C: SliderScene,
  },
  {
    id: "orb",
    name: "Liquid Orb",
    blurb: "A glass orb of swirling liquid, with every control.",
    Icon: Droplet,
    C: OrbScene,
  },
  {
    id: "horizon",
    name: "Event Horizon",
    blurb: "Light bending around a black hole.",
    Icon: Orbit,
    C: HorizonScene,
  },
  {
    id: "field",
    name: "Pressure Field",
    blurb: "Glowing lines lifted by moving noise.",
    Icon: Waves,
    C: FieldScene,
  },
  {
    id: "aura",
    name: "Modern Visual",
    blurb: "A glass crystal in rings of light.",
    Icon: Gem,
    C: AuraScene,
  },
  {
    id: "morph",
    name: "Particle Morph",
    blurb: "Particles that reshape themselves.",
    Icon: Sparkles,
    C: MorphScene,
  },
  {
    id: "ink",
    name: "Ink Flow",
    blurb: "A real fluid you stir with your finger.",
    Icon: Palette,
    C: InkScene,
  },
  {
    id: "flock",
    name: "Murmuration",
    blurb: "Thousands of starlings wheeling at dusk.",
    Icon: Bird,
    C: FlockScene,
  },
  {
    id: "sand",
    name: "Falling Sand",
    blurb: "Pour sand, water, fire and seeds.",
    Icon: Hourglass,
    C: SandScene,
  },
  {
    id: "galaxy",
    name: "Galaxy Forge",
    blurb: "A spiral galaxy, then two colliding.",
    Icon: Telescope,
    C: GalaxyScene,
  },
  {
    id: "ocean",
    name: "Ocean Day Cycle",
    blurb: "Dawn to storm to moonlit night on a shader sea.",
    Icon: Sunrise,
    C: OceanScene,
  },
  {
    id: "spacetime",
    name: "Curved Spacetime",
    blurb: "Throw stars and black holes across a bending grid.",
    Icon: Atom,
    C: SpacetimeScene,
  },
  {
    id: "aurora",
    name: "Aurora Painter",
    blurb: "Paint rippling northern lights across a starry sky.",
    Icon: MoonStar,
    C: AuroraScene,
  },
] as const;

const CREDITS = [
  [
    "Cosmic Anomaly Visualizer and Particle Animation",
    "Techartist",
    "https://codepen.io/VoXelo",
  ],
  [
    "Event Horizon",
    "Daniel Muñoz",
    "https://codepen.io/daniel-mu-oz/pen/BypKLLE",
  ],
  [
    "Liquid Gooey Orb Shader",
    "Tamino Martinius",
    "https://codepen.io/TaminoMartinius/pen/MYJEyer",
  ],
  [
    "WebGL Distortion Slider",
    "Ash Thornton",
    "https://codepen.io/ashthornton/pen/KRQbMO",
  ],
  [
    "Line2NodeMaterial",
    "Paul (prisoner849)",
    "https://codepen.io/prisoner849/pen/ogBXRvN",
  ],
  [
    "Modern Visual",
    "Russell Henderson",
    "https://codepen.io/russell-henderson/pen/jEVVqBe",
  ],
  [
    "WebGL Fluid Simulation, behind Ink Flow's shading",
    "Pavel Dobryakov",
    "https://github.com/PavelDoGreat/WebGL-Fluid-Simulation",
  ],
  [
    "Ocean Shader 6-Scene Day Cycle",
    "Margarita",
    "https://codepen.io/Margarita-the-solid/pen/xbgrWpd",
  ],
  [
    "Curved Spacetime",
    "Guilherme Zeni",
    "https://github.com/Guillhermm/web-ai-experiments",
  ],
] as const;

/** Randoms: one visual runs at a time; the rest stay unloaded. */
export function Randoms({
  items = {},
  only,
}: {
  items?: ExtrasStates;
  /** One Random on a page of its own, without the picker. */
  only?: string;
}) {
  // A new Random waiting on the owner's approval shows to admins only, marked as a preview.
  const viewer = useViewer();
  const preview = (id: string) => viewer.isAdmin && awaiting(items, id);
  const shown = only
    ? LIST.filter((x) => x.id === only)
    : LIST.filter((x) => stateOf(items, x.id) !== "hidden" || preview(x.id));
  const usable = only
    ? shown
    : shown.filter((x) => stateOf(items, x.id) === "on" || preview(x.id));
  const [id, setId] = useState<(typeof LIST)[number]["id"]>(
    usable[0]?.id ?? "storm",
  );
  const cur = usable.find((x) => x.id === id);
  if (!cur)
    return (
      <p className="text-sm text-muted">
        The Randoms are switched off for now. Check back soon.
      </p>
    );
  return (
    <div className="grid gap-3">
      <div className={s.picker} hidden={!!only}>
        {shown.map((x) => {
          const off = stateOf(items, x.id) === "off";
          const early = preview(x.id);
          return (
            <button
              key={x.id}
              type="button"
              className={s.pick}
              aria-pressed={x.id === id}
              disabled={off}
              onClick={() => setId(x.id)}
            >
              <b>
                <x.Icon aria-hidden /> {x.name}
              </b>
              <small>
                {early
                  ? "Preview: only admins see this until it's switched on in admin → Extras."
                  : off
                    ? "Off for now"
                    : x.blurb}
              </small>
            </button>
          );
        })}
      </div>
      <cur.C key={cur.id} />
      <p className={s.credit}>
        Built on open-source (MIT) work by{" "}
        {CREDITS.map(([what, who, url], i) => (
          <span key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {who}
            </a>{" "}
            ({what}){i < CREDITS.length - 1 ? ", " : "."}
          </span>
        ))}{" "}
        Photos from NASA and NOAA (public domain).
      </p>
    </div>
  );
}
