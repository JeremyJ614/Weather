/* eslint-disable @next/next/no-img-element -- logos are the organizations' own images */
"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  HandHeart,
  Mail,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import { SOCIALS, type Org } from "@/lib/disaster/data";
import { OrgSignup, VolunteerSignup } from "./Forms";
import faq from "@/app/faq/Faq.module.css";
import s from "./Disaster.module.css";

const TABS = [
  { id: "orgs", label: "Organizations" },
  { id: "volunteer", label: "Volunteer" },
  { id: "list", label: "List your organization" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const initials = (name: string) =>
  name
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

function OrgCard({ o }: { o: Org }) {
  const social = SOCIALS.filter((x) => o.socials[x.id]);
  return (
    <article className={s.card}>
      <header className={s.cardHead}>
        {o.logo_url ? (
          <img
            src={o.logo_url}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={s.logo}
          />
        ) : (
          <span className={s.mono} aria-hidden>
            {initials(o.name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className={s.name}>{o.name}</h3>
          <p className={s.areas}>
            <MapPin className="size-3.5" aria-hidden /> {o.areas}
          </p>
        </div>
      </header>
      <p className={s.mission}>{o.mission}</p>
      <ul className={s.tags} aria-label="What they offer">
        {o.services.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className={s.links}>
        {o.donate_url && (
          <a
            href={o.donate_url}
            target="_blank"
            rel="noopener noreferrer"
            className={s.lit}
          >
            <HandHeart className="size-4" aria-hidden /> Donate
          </a>
        )}
        {o.volunteer_url && (
          <a href={o.volunteer_url} target="_blank" rel="noopener noreferrer">
            Volunteer with them
          </a>
        )}
        {o.website && (
          <a href={o.website} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" aria-hidden /> Website
          </a>
        )}
        {o.phone && (
          <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>
            <Phone className="size-4" aria-hidden /> {o.phone}
          </a>
        )}
        {o.email && (
          <a href={`mailto:${o.email}`}>
            <Mail className="size-4" aria-hidden /> Email
          </a>
        )}
      </div>
      {social.length > 0 && (
        <p className={s.social}>
          {social.map((x) => (
            <a
              key={x.id}
              href={o.socials[x.id]}
              target="_blank"
              rel="noopener noreferrer"
            >
              {x.label}
            </a>
          ))}
        </p>
      )}
    </article>
  );
}

/** The Disaster Response page: the directory, the volunteer sign-up and the listing form. */
export function Directory({
  orgs,
  initial,
  prefill,
}: {
  orgs: Org[];
  initial?: string;
  prefill: { name: string; email: string };
}) {
  const [tab, setTab] = useState<Tab>(
    TABS.find((t) => t.id === initial)?.id ?? "orgs",
  );
  const [q, setQ] = useState("");
  const [need, setNeed] = useState<string | null>(null);
  const offered = useMemo(
    () => [...new Set(orgs.flatMap((o) => o.services))],
    [orgs],
  );
  const shown = orgs.filter((o) => {
    if (need && !o.services.includes(need)) return false;
    const t = q.trim().toLowerCase();
    return (
      !t ||
      [o.name, o.areas, o.mission, ...o.services].some((x) =>
        x.toLowerCase().includes(t),
      )
    );
  });

  return (
    <div className={faq.wrap}>
      <div className={faq.tabs} role="tablist" aria-label="Disaster Response">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orgs" && (
        <section role="tabpanel" className="grid gap-3">
          <label className={faq.search}>
            <Search className="size-4 text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, place or kind of help"
              aria-label="Search organizations"
            />
          </label>
          {offered.length > 1 && (
            <div className={s.filters} aria-label="Filter by kind of help">
              {offered.map((x) => (
                <button
                  key={x}
                  type="button"
                  aria-pressed={need === x}
                  onClick={() => setNeed(need === x ? null : x)}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          {!orgs.length ? (
            <p className={faq.empty}>
              No organizations are listed yet. Run one?{" "}
              <button
                type="button"
                className="text-accent underline"
                onClick={() => setTab("list")}
              >
                List it here
              </button>
              .
            </p>
          ) : !shown.length ? (
            <p className={faq.empty}>Nothing matches that search.</p>
          ) : (
            shown.map((o) => <OrgCard key={o.id} o={o} />)
          )}
          <p className="text-xs text-muted">
            Listings are reviewed by the StormSync team before they appear. In
            an emergency, call 911.
          </p>
        </section>
      )}

      {tab === "volunteer" && (
        <section role="tabpanel" className={s.panel}>
          <p className="text-sm text-muted">
            Sign up once and we&apos;ll match you with organizations working
            near you after a storm. Your details go only to the StormSync team.
          </p>
          <VolunteerSignup
            prefill={prefill}
            orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
          />
        </section>
      )}

      {tab === "list" && (
        <section role="tabpanel" className={s.panel}>
          <p className="text-sm text-muted">
            Help people after storms? Tell us about your organization. We review
            every listing and email you when it&apos;s up.
          </p>
          <OrgSignup prefill={prefill} />
        </section>
      )}
    </div>
  );
}
