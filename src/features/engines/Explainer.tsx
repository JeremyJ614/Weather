import { EXPERIMENTAL } from "@/lib/engines/confidence";
import s from "./Explainer.module.css";

/**
 * How an engine works (owner, Fix It List #36, 1): the red Experimental tag, the Confidence
 * tag in the level's color (both with a crackling electric outline), then the engine's
 * process as numbered steps. The outline is three displaced copies of the border, each
 * shown in turn, so only opacity animates; reduced motion and low tier phones keep one.
 */
export function Explainer({
  name,
  lead,
  steps,
  label,
  color,
}: {
  name: string;
  lead: string;
  steps: string[];
  label: string;
  color: string;
}) {
  return (
    <section
      className={s.explain}
      style={{ ["--cc" as string]: color }}
      aria-label={`How ${name} works`}
    >
      <svg className={s.defs} aria-hidden focusable="false">
        {[2, 7, 13].map((seed, i) => (
          <filter
            key={seed}
            id={`sswx-zap-${i + 1}`}
            x="-20%"
            y="-60%"
            width="140%"
            height="220%"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.05 0.11"
              numOctaves="2"
              seed={seed}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="5"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </svg>
      <div className={s.tags}>
        <Zap color={EXPERIMENTAL}>Experimental</Zap>
        <Zap color={color}>
          <small>Confidence:</small> {label}
        </Zap>
      </div>
      <header className={s.head}>
        <span className={s.eyebrow}>The process</span>
        <h2>How {name} works</h2>
        <p>{lead}</p>
      </header>
      <ol className={s.steps}>
        {steps.map((t, i) => (
          <li key={t.slice(0, 24)} style={{ ["--i" as string]: i }}>
            <span className={s.n} aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <p>{t}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Zap({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className={s.zap} style={{ ["--z" as string]: color }}>
      <i className={s.edge} data-n="1" aria-hidden />
      <i className={s.edge} data-n="2" aria-hidden />
      <i className={s.edge} data-n="3" aria-hidden />
      <i className={s.glow} aria-hidden />
      <i className={s.g1} aria-hidden />
      <i className={s.g2} aria-hidden />
      <i className={s.halo} aria-hidden />
      <b>{children}</b>
    </span>
  );
}
