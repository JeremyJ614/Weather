"use client";

import { useState } from "react";
import {
  Droplet,
  Gem,
  Images,
  Orbit,
  Sparkles,
  Tornado,
  Waves,
} from "lucide-react";
import {
  AuraScene,
  FieldScene,
  HorizonScene,
  MorphScene,
  OrbScene,
  SliderScene,
  StormScene,
} from "./Scenes";
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
] as const;

/** Randoms: one visual runs at a time; the rest stay unloaded. */
export function Randoms() {
  const [id, setId] = useState<(typeof LIST)[number]["id"]>("storm");
  const cur = LIST.find((x) => x.id === id)!;
  return (
    <div className="grid gap-3">
      <div className={s.picker}>
        {LIST.map((x) => (
          <button
            key={x.id}
            type="button"
            className={s.pick}
            aria-pressed={x.id === id}
            onClick={() => setId(x.id)}
          >
            <b>
              <x.Icon aria-hidden /> {x.name}
            </b>
            <small>{x.blurb}</small>
          </button>
        ))}
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
