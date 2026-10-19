"use client";

import { useState } from "react";
import { ContactForm } from "@/features/contact/ContactForm";
import type { ContactTab } from "@/lib/help/forms";
import s from "../faq/Faq.module.css";

/** One tab per form the owner has switched on. */
export function ContactView({
  tabs,
  initial,
  prefill,
}: {
  tabs: ContactTab[];
  initial?: string;
  prefill: Record<string, string>;
}) {
  const [id, setId] = useState(
    tabs.find((t) => t.id === initial)?.id ?? tabs[0]?.id,
  );
  const tab = tabs.find((t) => t.id === id) ?? tabs[0];
  if (!tab)
    return (
      <p className={s.empty}>
        The contact forms are closed right now. Please check back soon.
      </p>
    );
  return (
    <div className={s.wrap}>
      {tabs.length > 1 && (
        <div className={s.tabs} role="tablist" aria-label="Contact forms">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => setId(t.id)}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
      <section
        role="tabpanel"
        className="grid gap-3 rounded-[20px] border border-line bg-[var(--surface)] p-4"
      >
        {tab.intro && <p className="text-sm text-muted">{tab.intro}</p>}
        <ContactForm key={tab.id} tab={tab} prefill={prefill} />
      </section>
    </div>
  );
}
