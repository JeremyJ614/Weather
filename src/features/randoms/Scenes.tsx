"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Stage } from "./Stage";
import type { Storm } from "./engines/storm";
import type { Horizon, Quality } from "./engines/horizon";
import type { Blend, Orb, OrbValues } from "./engines/orb";
import type { Field } from "./engines/field";
import type { Aura } from "./engines/aura";
import type { Morph } from "./engines/morph";
import type { Slider } from "./engines/slider";
import type { Ink } from "./engines/ink";
import type { Material, Sand } from "./engines/sand";
import type { Galaxy } from "./engines/galaxy";
import type { Ocean } from "./engines/ocean";
import type {
  Spacetime,
  SpacetimeScene,
  SpacetimeTheme,
} from "./engines/spacetime";
import { SLIDES } from "./slides";
import s from "./Randoms.module.css";

function Range({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className={s.range}>
      {label}
      <b>{value.toFixed(step >= 1 ? 0 : 2)}</b>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggles({
  items,
}: {
  items: { label: string; on: boolean; set: (on: boolean) => void }[];
}) {
  return (
    <div className={s.toggles}>
      {items.map((t) => (
        <button
          key={t.label}
          type="button"
          aria-pressed={t.on}
          onClick={() => t.set(!t.on)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StormScene() {
  const [scene, setScene] = useState<Storm | null>(null);
  const [list, setList] = useState<
    typeof import("./engines/storm").STORMS | null
  >(null);
  const [i, setI] = useState(0);
  const [spin, setSpin] = useState(true);
  const [bolts, setBolts] = useState(true);
  const info = list?.[i];
  return (
    <>
      <Stage
        label="Storm Visualizer: particles forming a storm you can turn"
        load={async (el, ctx) => {
          const m = await import("./engines/storm");
          setList(m.STORMS);
          setSpin(!ctx.reduced);
          setBolts(!ctx.reduced);
          return m.mount(el, ctx);
        }}
        onReady={(sc) => setScene(sc)}
      >
        {info && (
          <div className={s.title}>
            <small>Storm Visualizer</small>
            <b>{info.name}</b>
          </div>
        )}
        <div className={s.hud}>
          <div className={s.nav}>
            <button
              type="button"
              aria-label="Previous storm"
              onClick={() => scene && setI(scene.go(-1))}
            >
              <ChevronLeft aria-hidden />
            </button>
            <span>
              Storm {i + 1} / {list?.length ?? 3}
            </span>
            <button
              type="button"
              aria-label="Next storm"
              onClick={() => scene && setI(scene.go(1))}
            >
              <ChevronRight aria-hidden />
            </button>
          </div>
        </div>
      </Stage>
      {info && (
        <section className={`${s.panel} ${s.info}`}>
          <h4>{info.name}</h4>
          <p>{info.copy}</p>
          <dl>
            <dt>Structure</dt>
            <dd>{info.structure}</dd>
            <dt>Telltale signs</dt>
            <dd>{info.signs}</dd>
            <dt>Motion</dt>
            <dd>{info.motion}</dd>
          </dl>
          <Toggles
            items={[
              {
                label: "Spin",
                on: spin,
                set: (on) => {
                  setSpin(on);
                  scene?.spin(on);
                },
              },
              {
                label: "Lightning",
                on: bolts,
                set: (on) => {
                  setBolts(on);
                  scene?.lightning(on);
                },
              },
            ]}
          />
          <p className={s.hint}>
            Drag to turn it, pinch to zoom. Every particle is placed on the GPU
            each frame, so the storm keeps moving the whole time.
          </p>
        </section>
      )}
    </>
  );
}

export function SliderScene() {
  const [scene, setScene] = useState<Slider | null>(null);
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const go = (n: number) => {
    const k = (n + SLIDES.length) % SLIDES.length;
    setI(k);
    scene?.show(k);
  };
  return (
    <>
      <Stage
        shape="photo"
        label={`The Weather Slider: ${slide.name}`}
        load={async (el, ctx) =>
          (await import("./engines/slider")).mount(
            el,
            ctx,
            SLIDES.map((x) => x.src),
          )
        }
        onReady={(sc) => setScene(sc)}
      >
        <div className={s.title}>
          <small>The Weather Slider</small>
          <b>{slide.name}</b>
          <p>{slide.line}</p>
        </div>
      </Stage>
      <div className={s.under}>
        <div className={s.dots}>
          {SLIDES.map((x, k) => (
            <button
              key={x.name}
              type="button"
              aria-label={x.name}
              aria-current={k === i}
              onClick={() => go(k)}
            />
          ))}
        </div>
        <div className={s.nav}>
          <button type="button" aria-label="Previous" onClick={() => go(i - 1)}>
            <ChevronLeft aria-hidden />
          </button>
          <span>
            {i + 1} / {SLIDES.length}
          </span>
          <button type="button" aria-label="Next" onClick={() => go(i + 1)}>
            <ChevronRight aria-hidden />
          </button>
        </div>
      </div>
      <section className={`${s.panel} ${s.info}`}>
        <h4>{slide.name}</h4>
        <p>{slide.about}</p>
        <p className={s.credit}>
          Photo: {slide.credit}.{" "}
          <a href={slide.page} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      </section>
    </>
  );
}

export function OrbScene() {
  const [scene, setScene] = useState<Orb | null>(null);
  const [orb, setOrb] = useState<typeof import("./engines/orb") | null>(null);
  const [v, setV] = useState<OrbValues | null>(null);
  const [preset, setPreset] = useState(0);
  const [blend, setBlend] = useState<Blend>("Auto");
  const update = (next: OrbValues, b = blend) => {
    setV(next);
    scene?.update(next, b);
  };
  return (
    <>
      <Stage
        label="Liquid Orb: a glassy blob with swirling liquid inside"
        load={async (el, ctx) => {
          const m = await import("./engines/orb");
          setOrb(m);
          setV({ ...m.PRESETS[0].values });
          return m.mount(el, ctx);
        }}
        onReady={(sc) => setScene(sc)}
      />
      {v && orb && (
        <section className={s.panel}>
          <h4>Presets</h4>
          <div className={s.presets}>
            {orb.PRESETS.map((p, k) => (
              <button
                key={p.name}
                type="button"
                aria-pressed={k === preset}
                onClick={() => {
                  setPreset(k);
                  update({ ...p.values });
                }}
              >
                <i
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${p.values.colorBlue}, ${p.values.colorMagenta} 70%, ${p.values.background})`,
                  }}
                />
                {p.name}
              </button>
            ))}
          </div>
          {orb.ORB_CONTROLS.map((f) => (
            <details
              key={f.folder}
              className={s.folder}
              open={f.folder === "Shape"}
            >
              <summary>{f.folder}</summary>
              <div>
                {f.rows.map(([k, label, min, max, step]) => (
                  <Range
                    key={k}
                    label={label}
                    min={min}
                    max={max}
                    step={step}
                    value={v[k] as number}
                    onChange={(x) => update({ ...v, [k]: x })}
                  />
                ))}
              </div>
            </details>
          ))}
          <details className={s.folder}>
            <summary>Colors</summary>
            <div>
              <div className={s.colors}>
                {orb.ORB_COLORS.map(([k, label]) => (
                  <label key={k}>
                    <input
                      type="color"
                      value={String(v[k])}
                      onChange={(e) => update({ ...v, [k]: e.target.value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <label className={s.text}>
                Blend mode
                <select
                  value={blend}
                  onChange={(e) => {
                    const b = e.target.value as Blend;
                    setBlend(b);
                    update(v, b);
                  }}
                >
                  <option value="Auto">Auto (by background)</option>
                  <option value="Glow">Glow (for dark backgrounds)</option>
                  <option value="Ink">Ink (for light backgrounds)</option>
                </select>
              </label>
            </div>
          </details>
        </section>
      )}
    </>
  );
}

export function HorizonScene() {
  const [scene, setScene] = useState<Horizon | null>(null);
  const [vals, setVals] = useState({
    exposure: 1,
    glow: 0.9,
    speed: 1,
    temperature: 0.45,
  });
  const [flags, setFlags] = useState({
    doppler: true,
    nebula: true,
    orbit: true,
  });
  const [text, setText] = useState("STORMSYNC");
  const [q, setQ] = useState<Quality>("medium");
  return (
    <>
      <Stage
        label="Event Horizon: light bending around a black hole"
        load={async (el, ctx) => {
          if (ctx.reduced) setFlags((f) => ({ ...f, orbit: false }));
          return (await import("./engines/horizon")).mount(el, ctx);
        }}
        onReady={(sc) => {
          setScene(sc);
          sc.onQuality(setQ);
        }}
      >
        <div className={s.title}>
          <small>Event Horizon</small>
          <b>Black hole</b>
        </div>
      </Stage>
      <section className={s.panel}>
        <label className={s.text}>
          Text in space
          <input
            value={text}
            maxLength={26}
            onChange={(e) => {
              setText(e.target.value);
              scene?.text(e.target.value);
            }}
            placeholder="Empty means no text"
          />
        </label>
        {(
          [
            ["exposure", "Exposure", 0.2, 2.5],
            ["glow", "Glow", 0, 2],
            ["speed", "Orbit speed", 0, 3],
            ["temperature", "Temperature", 0, 1],
          ] as const
        ).map(([k, label, min, max]) => (
          <Range
            key={k}
            label={label}
            min={min}
            max={max}
            step={0.05}
            value={vals[k]}
            onChange={(x) => {
              setVals({ ...vals, [k]: x });
              scene?.set(k, x);
            }}
          />
        ))}
        <Toggles
          items={(["doppler", "nebula", "orbit"] as const).map((k) => ({
            label:
              k === "doppler"
                ? "Doppler"
                : k === "nebula"
                  ? "Nebula"
                  : "Auto orbit",
            on: flags[k],
            set: (on) => {
              setFlags({ ...flags, [k]: on });
              scene?.toggle(k, on);
            },
          }))}
        />
        <h4>Quality</h4>
        <Toggles
          items={(["low", "medium", "high"] as const).map((k) => ({
            label: k[0].toUpperCase() + k.slice(1),
            on: q === k,
            set: () => scene?.quality(k),
          }))}
        />
        <p className={s.hint}>
          Drag to orbit, pinch or scroll to zoom, double-tap to reset. If your
          phone can&apos;t hold a smooth frame rate, it steps the quality down
          on its own.
        </p>
      </section>
    </>
  );
}

export function FieldScene() {
  const [scene, setScene] = useState<Field | null>(null);
  const [height, setHeight] = useState(4);
  const [speed, setSpeed] = useState(0.25);
  const [color, setColor] = useState("#7fffd4");
  return (
    <>
      <Stage
        label="Pressure Field: glowing lines lifted by moving noise"
        load={async (el, ctx) => {
          if (ctx.reduced) setSpeed(0.08);
          return (await import("./engines/field")).mount(el, ctx);
        }}
        onReady={(sc) => setScene(sc)}
      />
      <section className={s.panel}>
        <Range
          label="Wave height"
          min={0}
          max={8}
          step={0.1}
          value={height}
          onChange={(v) => {
            setHeight(v);
            scene?.set("height", v);
          }}
        />
        <Range
          label="Speed"
          min={0}
          max={1}
          step={0.01}
          value={speed}
          onChange={(v) => {
            setSpeed(v);
            scene?.set("speed", v);
          }}
        />
        <div className={s.colors}>
          <label>
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                scene?.color(e.target.value);
              }}
            />
            Color
          </label>
        </div>
        <p className={s.hint}>
          Thousands of line segments and sparks, all moved on the GPU. Drag to
          orbit.
        </p>
      </section>
    </>
  );
}

export function AuraScene() {
  const [scene, setScene] = useState<Aura | null>(null);
  const [spin, setSpin] = useState(true);
  return (
    <>
      <Stage
        label="Modern Visual: a glass crystal in rings of light"
        load={async (el, ctx) => {
          if (ctx.reduced) setSpin(false);
          return (await import("./engines/aura")).mount(el, ctx);
        }}
        onReady={(sc) => setScene(sc)}
      />
      <section className={s.panel}>
        <Toggles
          items={[
            {
              label: "Spin",
              on: spin,
              set: (on) => {
                setSpin(on);
                scene?.spin(on);
              },
            },
          ]}
        />
        <p className={s.hint}>Drag to turn it, pinch to zoom.</p>
      </section>
    </>
  );
}

export function MorphScene() {
  const [scene, setScene] = useState<Morph | null>(null);
  const [shapes, setShapes] = useState<string[]>([]);
  const [i, setI] = useState(0);
  return (
    <>
      <Stage
        label="Particle Morph: particles reshaping themselves"
        load={async (el, ctx) => {
          const m = await import("./engines/morph");
          setShapes(m.SHAPES);
          return m.mount(el, ctx);
        }}
        onReady={(sc) => setScene(sc)}
      >
        <div className={s.hud}>
          <div className={s.nav}>
            <span>{shapes[i] ?? ""}</span>
            <button
              type="button"
              aria-label="Next shape"
              onClick={() => scene && setI(scene.next())}
            >
              <ChevronRight aria-hidden />
            </button>
          </div>
        </div>
      </Stage>
      <p className={s.hint}>
        Move your finger across it to tilt; tap the arrow to morph.
      </p>
    </>
  );
}

export function InkScene() {
  const [scene, setScene] = useState<Ink | null>(null);
  return (
    <>
      <Stage
        label="Ink Flow: colored ink swirling in a fluid you stir"
        load={async (el, ctx) => (await import("./engines/ink")).mount(el, ctx)}
        onReady={(sc) => setScene(sc)}
        shape="tall"
      />
      <section className={s.panel}>
        <Toggles
          items={[
            { label: "Splash more ink", on: false, set: () => scene?.splash() },
          ]}
        />
        <p className={s.hint}>
          Drag through it to stir. The ink is a real fluid: it swirls, curls
          into eddies and slowly fades.
        </p>
      </section>
    </>
  );
}

export function FlockScene() {
  return (
    <>
      <Stage
        label="Murmuration: a flock of starlings wheeling at dusk"
        load={async (el, ctx) =>
          (await import("./engines/flock")).mount(el, ctx)
        }
        shape="tall"
      />
      <p className={s.hint}>
        Thousands of starlings, each only watching its neighbors. Touch the sky
        (or move the mouse through it) and they scatter from you like from a
        falcon.
      </p>
    </>
  );
}

export function SandScene() {
  const [scene, setScene] = useState<Sand | null>(null);
  const [mats, setMats] = useState<readonly Material[]>([]);
  const [mat, setMat] = useState<Material>("Sand");
  return (
    <>
      <Stage
        label="Falling Sand: a sandbox of sand, water, fire and plants"
        load={async (el, ctx) => {
          const m = await import("./engines/sand");
          setMats(m.MATERIALS);
          return m.mount(el, ctx);
        }}
        onReady={(sc) => setScene(sc)}
        shape="tall"
      />
      <section className={s.panel}>
        <Toggles
          items={mats.map((m) => ({
            label: m,
            on: m === mat,
            set: () => {
              setMat(m);
              scene?.use(m);
            },
          }))}
        />
        <Toggles
          items={[
            { label: "Empty", on: false, set: () => scene?.clear() },
            { label: "Start over", on: false, set: () => scene?.reset() },
          ]}
        />
        <p className={s.hint}>
          Drag to pour. Water puts fire out, fire burns plants and seeds, and
          seeds sprout where they touch water.
        </p>
      </section>
    </>
  );
}

export function GalaxyScene() {
  const [scene, setScene] = useState<Galaxy | null>(null);
  const [two, setTwo] = useState(false);
  return (
    <>
      <Stage
        label="Galaxy Forge: a spiral galaxy, and two galaxies colliding"
        load={async (el, ctx) =>
          (await import("./engines/galaxy")).mount(el, ctx)
        }
        onReady={(sc) => setScene(sc)}
        shape="tall"
      />
      <section className={s.panel}>
        <Toggles
          items={[
            {
              label: "One galaxy",
              on: !two,
              set: () => {
                setTwo(false);
                scene?.single();
              },
            },
            {
              label: "Collide two",
              on: two,
              set: () => {
                setTwo(true);
                scene?.collide();
              },
            },
          ]}
        />
        <p className={s.hint}>
          Drag to turn it, scroll to zoom. Colliding galaxies throw out long
          tidal tails before their cores merge, as the Antennae and the Mice did
          in real life.
        </p>
      </section>
    </>
  );
}

export function OceanScene() {
  const [scene, setScene] = useState<Ocean | null>(null);
  const [list, setList] = useState<
    typeof import("./engines/ocean").OCEAN_SCENES | null
  >(null);
  const [day, setDay] = useState(0);
  const [auto, setAuto] = useState(true);
  const n = list?.length ?? 6;
  const at = list?.[Math.min(n - 1, Math.floor(day * n))];
  return (
    <>
      <Stage
        label="Ocean Day Cycle: a shader ocean from dawn through storm and night"
        load={async (el, ctx) => {
          const m = await import("./engines/ocean");
          setList(m.OCEAN_SCENES);
          if (ctx.reduced) setAuto(false);
          return m.mount(el, ctx);
        }}
        onReady={(sc) => {
          setScene(sc);
          sc.onProgress(setDay);
        }}
        shape="tall"
      >
        {at && (
          <div className={s.title}>
            <small>Ocean Day Cycle · {Math.round(day * 100)}%</small>
            <b>{at.name}</b>
            <p>{at.about}</p>
          </div>
        )}
      </Stage>
      <section className={s.panel}>
        <Range
          label="Time of day"
          min={0}
          max={100}
          step={1}
          value={Math.round(day * 100)}
          onChange={(v) => {
            setAuto(false);
            scene?.seek(v / 100);
          }}
        />
        <Toggles
          items={(list ?? []).map((x, i) => ({
            label: x.name,
            on: at?.name === x.name,
            set: () => {
              setAuto(false);
              scene?.seek(i / (n - 1));
            },
          }))}
        />
        <Toggles
          items={[
            {
              label: "Auto day cycle",
              on: auto,
              set: (on) => {
                setAuto(on);
                scene?.auto(on);
              },
            },
          ]}
        />
        <p className={s.hint}>
          Drag across the water to move through the day. The storm brings
          lightning out on the horizon; at night the moon lays a silver path on
          the swells. If your phone can&apos;t hold a smooth frame rate, it
          renders a little softer on its own.
        </p>
      </section>
    </>
  );
}

export function SpacetimeScene() {
  const [scene, setScene] = useState<Spacetime | null>(null);
  const [now, setNow] = useState<SpacetimeScene>("orbit");
  const [theme, setTheme] = useState<SpacetimeTheme>("classic");
  const [full, setFull] = useState(false);
  const scenes: [SpacetimeScene, string][] = [
    ["orbit", "Star & planet"],
    ["binary", "Binary stars"],
    ["merger", "Black hole merger"],
    ["solar", "Solar system"],
  ];
  return (
    <>
      <Stage
        label="Curved Spacetime: stars, planets and black holes bending a glowing grid"
        load={async (el, ctx) =>
          (await import("./engines/spacetime")).mount(el, ctx)
        }
        onReady={(sc) => setScene(sc)}
        shape="tall"
      >
        <div className={s.title}>
          <small>Curved Spacetime</small>
          <b>Gravity as a rubber sheet</b>
        </div>
      </Stage>
      <section className={s.panel}>
        <h4>Start from</h4>
        <Toggles
          items={scenes.map(([k, label]) => ({
            label,
            on: now === k,
            set: () => {
              setNow(k);
              setFull(false);
              scene?.scene(k);
            },
          }))}
        />
        <h4>Add</h4>
        <Toggles
          items={[
            ...(["planet", "star", "hole"] as const).map((k) => ({
              label:
                k === "planet"
                  ? "+ Planet"
                  : k === "star"
                    ? "+ Star"
                    : "+ Black hole",
              on: false,
              set: () => setFull(!(scene?.add(k) ?? true)),
            })),
            {
              label: "Clear",
              on: false,
              set: () => {
                setFull(false);
                scene?.clear();
              },
            },
          ]}
        />
        {full && (
          <p className={s.hint} role="status">
            The sheet holds eight bodies at most, with room around each. Clear
            some or let them merge.
          </p>
        )}
        <h4>Grid colors</h4>
        <Toggles
          items={(
            [
              ["classic", "Classic"],
              ["gold", "StormSync gold"],
              ["royal", "Royal purple"],
            ] as const
          ).map(([k, label]) => ({
            label,
            on: theme === k,
            set: () => {
              setTheme(k);
              scene?.theme(k);
            },
          }))}
        />
        <p className={s.hint}>
          Drag a body to move or throw it, pinch on one to change its mass,
          double-tap empty space for a planet or hold for a black hole. Drag
          space to orbit, pinch to zoom. Two black holes that meet merge and
          send gravitational-wave ripples across the sheet.
        </p>
      </section>
    </>
  );
}

export function AuroraScene() {
  return (
    <>
      <Stage
        label="Aurora Painter: northern lights you paint across a night sky"
        load={async (el, ctx) =>
          (await import("./engines/aurora")).mount(el, ctx)
        }
        shape="tall"
      />
      <p className={s.hint}>
        Drag across the sky to paint the northern lights. Green curtains with
        violet tops ripple and fold like real aurora arcs, then slowly fade.
        Leave it alone and a new arc drifts in by itself.
      </p>
    </>
  );
}
