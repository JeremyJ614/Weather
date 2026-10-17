"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Crown, Sparkles, Ticket, Zap } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import {
  addonPrice,
  activePromos,
  couponOff,
  money,
  quote,
  tierPages,
  type Billing,
  type Choice,
  type Promo,
  type TierId,
} from "@/lib/billing/plans";
import { checkCoupon, savePlan, type PlanResult } from "./actions";
import s from "./Join.module.css";

type Page = { slug: string; label: string; icon: string; phase: string };
type Current = {
  tier: string;
  cycle: string;
  pages: string[];
  addons: string[];
  status: string;
} | null;
const KEY = "sswx-plan";

/** A price that glides from its last value to the new one (text only; still under reduced motion). */
function Ticker({ cents }: { cents: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(cents);
  useEffect(() => {
    const el = ref.current;
    const from = last.current;
    last.current = cents;
    if (
      !el ||
      from === cents ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (el) el.textContent = money(cents);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      el.textContent = money(
        Math.round(from + (cents - from) * (1 - (1 - k) ** 3)),
      );
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [cents]);
  return <span ref={ref}>{money(cents)}</span>;
}

/** The signup page: plans first, then the account. Prices are re-checked on the server. */
export function JoinView({
  billing,
  claims,
  promos,
  today,
  pages,
  signedIn,
  hasProfile,
  current,
  locked,
}: {
  billing: Billing;
  claims: Record<string, number>;
  promos: (Promo & { left?: number })[];
  today: string;
  pages: Page[];
  signedIn: boolean;
  hasProfile: boolean;
  current: Current;
  /** The page a plan lock sent this member here from. */
  locked: { label: string; tier: string | null } | null;
}) {
  const sellable = pages.map((p) => p.slug);
  const label = new Map(pages.map((p) => [p.slug, p]));
  const [choice, setChoice] = useState<Choice>(() =>
    // Custom page-by-page plans were retired; an old one starts over on Basic.
    current && current.tier !== "custom"
      ? {
          tier: current.tier as Choice["tier"],
          cycle: current.cycle as Choice["cycle"],
          pages: current.pages,
          addons: current.addons,
        }
      : { tier: "basic", cycle: "month", pages: [], addons: [] },
  );
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{
    code: string;
    kind: string;
    amount: number;
  } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // Coming back from sign-in: restore the plan they built before signing in.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("resume")) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
        choice: Choice;
        code: string;
      } | null;
      if (saved?.choice)
        queueMicrotask(() => {
          setChoice(saved.choice);
          setCode(saved.code ?? "");
        });
    } catch {
      /* nothing saved */
    }
  }, []);

  const fit = activePromos(billing, claims, today, choice);
  const q = quote(billing, choice, sellable, fit);
  const first = couponOff(q.first[0], coupon);
  const per = choice.cycle === "year" ? "yr" : "mo";
  const tier = billing.tiers.find((t) => t.id === choice.tier);
  const covered =
    choice.tier === "custom"
      ? new Set<string>()
      : tierPages(billing, choice.tier, sellable);
  const extras = choice.addons.filter((p) => label.has(p) && !covered.has(p));
  const promoOff = q.regular - q.first[0];
  const couponCut = q.first[0] - first;
  const bestYear = Math.max(
    ...billing.tiers
      .filter((t) => t.month > 0)
      .map((t) => Math.round(100 - (t.year * 100) / (t.month * 12))),
  );

  const set = (patch: Partial<Choice>) => {
    setResult(null);
    setChoice({ ...choice, ...patch });
  };
  const toggle = (list: "pages" | "addons", slug: string) =>
    set({
      [list]: choice[list].includes(slug)
        ? choice[list].filter((x) => x !== slug)
        : [...choice[list], slug],
    });

  const go = () => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ choice, code: coupon?.code ?? "" }),
      );
    } catch {
      /* private mode */
    }
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent("/join?resume=1")}`);
      return;
    }
    if (!hasProfile) {
      router.push(`/welcome?next=${encodeURIComponent("/join?resume=1")}`);
      return;
    }
    start(async () => {
      const r = await savePlan(choice, coupon?.code ?? "");
      setResult(r);
      if (!("error" in r))
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
    });
  };

  const tierCard = (t: Billing["tiers"][number], i: number) => {
    const on = choice.tier === t.id;
    const price = choice.cycle === "year" ? t.year : t.month;
    const base =
      t.id === "basic"
        ? billing.tiers[0].pages
        : t.id === "chasers" || t.id === "advanced"
          ? billing.tiers[1].pages
          : [];
    const fresh =
      t.id === "vip"
        ? []
        : t.pages.filter((p) => label.has(p) && !base.includes(p));
    const count =
      t.id === "vip"
        ? sellable.length
        : t.pages.filter((p) => label.has(p)).length;
    return (
      <li key={t.id} style={{ ["--i" as string]: i }}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => set({ tier: t.id as TierId, pages: [] })}
          className={`${s.card} ${t.id === "vip" ? s.vip : ""}`}
        >
          <span className={s.cardTop}>
            <span className={s.cardName}>
              {t.id === "vip" ? (
                <Crown aria-hidden />
              ) : t.id === "chasers" ? (
                <Zap aria-hidden />
              ) : null}
              {t.name}
            </span>
            <span className={s.price}>
              {price === 0 ? "Free" : money(price)}
              {price > 0 && <small>/{per}</small>}
            </span>
          </span>
          <span className={s.tag}>{t.tagline}</span>
          <span className={s.meta}>
            {count} pages
            {choice.cycle === "year" &&
              price > 0 &&
              ` · ${money(Math.round(price / 12))}/mo`}
          </span>
          <span className={s.check} aria-hidden>
            <Check />
          </span>
        </button>
        {fresh.length > 0 && (
          <details
            className={s.more}
            open={open === t.id}
            onToggle={(e) => e.currentTarget.open && setOpen(t.id)}
          >
            <summary>
              {t.id === "free" ? "What's included" : `What ${t.name} adds`}{" "}
              <ChevronDown aria-hidden />
            </summary>
            <ul>
              {fresh.map((p) => (
                <li key={p}>
                  <NavIcon name={label.get(p)!.icon} className="size-4" />{" "}
                  {label.get(p)!.label}
                </li>
              ))}
            </ul>
          </details>
        )}
      </li>
    );
  };

  const chip = (slug: string, list: "pages" | "addons") => {
    const p = label.get(slug)!;
    const on = choice[list].includes(slug);
    return (
      <button
        key={slug}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(list, slug)}
        className={s.chip}
      >
        <NavIcon name={p.icon} className="size-4" />
        <span>{p.label}</span>
        <small>{money(addonPrice(billing, slug))}</small>
      </button>
    );
  };

  return (
    <main className={s.main}>
      <section className={s.hero}>
        <div className={s.aurora} aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <p className={s.eyebrow}>StormSync Weather</p>
        <h1 className={s.title}>
          Every storm, <span>your way.</span>
        </h1>
        <p className={s.sub}>
          Start free or pick a plan, then add any extra pages you want. Change
          it any time.
        </p>
        <Link href="?showcase" scroll={false} className={s.see}>
          <Sparkles aria-hidden /> See what you get
        </Link>
      </section>

      {locked && (
        <aside className={s.promo} role="status">
          <Crown aria-hidden />
          <span>
            <b>{locked.label} isn&apos;t on your plan</b>
            <small>
              {locked.tier
                ? `It comes with ${locked.tier} and up, or add it to any plan below.`
                : "Add it to any plan below."}
            </small>
          </span>
        </aside>
      )}

      {promos.map((p) => (
        <aside key={p.id} className={s.promo}>
          <Sparkles aria-hidden />
          <span>
            <b>{p.name}</b>
            <small>{p.blurb}</small>
          </span>
          {p.left !== undefined && p.firstN && (
            <span className={s.spots}>
              <b>{p.left}</b> of {p.firstN} left
              <i style={{ transform: `scaleX(${p.left / p.firstN})` }} />
            </span>
          )}
        </aside>
      ))}

      <div className={s.cycle} role="group" aria-label="Billing">
        {(["month", "year"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choice.cycle === c}
            onClick={() => set({ cycle: c })}
          >
            {c === "month" ? "Monthly" : "Yearly"}
            {c === "year" && bestYear > 0 && (
              <small>save up to {bestYear}%</small>
            )}
          </button>
        ))}
      </div>

      <ol className={s.cards}>{billing.tiers.map(tierCard)}</ol>

      {choice.tier !== "vip" ? (
        <section className={s.pick}>
          <h2>Add-ons</h2>
          <p className={s.note}>Add any page to your plan, billed monthly.</p>
          <div className={s.chips}>
            {sellable
              .filter((p) => !covered.has(p))
              .map((p) => chip(p, "addons"))}
          </div>
        </section>
      ) : null}

      {q.regular > 0 && (
        <form
          className={s.code}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const c = await checkCoupon(code, choice.tier);
              setCoupon(c);
              setCodeMsg(
                c
                  ? `${c.code} applied`
                  : "That code isn't valid for this plan.",
              );
            });
          }}
        >
          <Ticket aria-hidden />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Promo code"
            aria-label="Promo code"
            maxLength={24}
          />
          <button type="submit" disabled={!code.trim() || pending}>
            Apply
          </button>
          {codeMsg && <small role="status">{codeMsg}</small>}
        </form>
      )}

      {result && (
        <div className={s.result} role="status">
          {"error" in result ? (
            <p>{result.error}</p>
          ) : result.status === "free" ? (
            <p>
              <b>You&apos;re all set on Free.</b> Everything free is open now.{" "}
              <Link href="/">Go to the homepage</Link>
            </p>
          ) : (
            <p>
              <b>Your plan is saved.</b> Card payments open soon: nothing has
              been charged, and you&apos;ll confirm before your first payment (
              {money(result.first)}
              {result.promo ? ` with ${result.promo}` : ""}).
            </p>
          )}
        </div>
      )}

      <div className={s.tracker}>
        <ul className={s.receipt} aria-label="Your receipt">
          <li>
            <span>
              {tier?.name ?? "Plan"} ·{" "}
              {choice.cycle === "year" ? "yearly" : "monthly"}
            </span>
            <b>{q.base ? money(q.base) : "Free"}</b>
          </li>
          {extras.map((p) => (
            <li key={p}>
              <span>+ {label.get(p)!.label}</span>
              <b>
                {money(
                  addonPrice(billing, p) * (choice.cycle === "year" ? 12 : 1),
                )}
              </b>
            </li>
          ))}
          {promoOff > 0 && q.promo && (
            <li className={s.off}>
              <span>{q.promo.name}</span>
              <b>−{money(promoOff)}</b>
            </li>
          )}
          {coupon && couponCut > 0 && (
            <li className={s.off}>
              <span>Code {coupon.code}</span>
              <b>−{money(couponCut)}</b>
            </li>
          )}
        </ul>
        <div className={s.totalRow}>
          <div className={s.total}>
            <span className={s.label}>
              Total{" "}
              {first !== q.regular
                ? `first ${per === "mo" ? "month" : "year"}`
                : `per ${per === "mo" ? "month" : "year"}`}
            </span>
            <span className={s.now}>
              <Ticker cents={first} />
            </span>
            {first !== q.regular && (
              <span className={s.then}>
                then {money(q.regular)}/{per}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={go}
            disabled={pending}
            className={s.cta}
          >
            {pending
              ? "Saving…"
              : !signedIn
                ? q.regular
                  ? "Continue"
                  : "Start free"
                : "Choose plan"}
          </button>
        </div>
      </div>
    </main>
  );
}
