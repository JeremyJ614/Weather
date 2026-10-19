"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FAQ_LIMITS, type Faq, type FaqSection } from "@/lib/help/faq";
import { saveFaq } from "./actions";

const field =
  "min-h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm";
const icon =
  "grid size-9 place-items-center rounded-lg border border-line text-muted disabled:opacity-30";
const uid = (p: string) =>
  `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const move = <T,>(l: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= l.length) return l;
  const o = [...l];
  [o[i], o[j]] = [o[j], o[i]];
  return o;
};

/** Tabs → categories → questions: add, rename, reorder and remove each. */
export function FaqEditor({ faq: initial }: { faq: Faq }) {
  const [faq, setFaq] = useState(initial);
  const [at, setAt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (next: Faq) => {
    setFaq(next);
    setDirty(true);
    setStatus(null);
  };
  const tab = faq.tabs[at];
  const setTab = (patch: Partial<(typeof faq.tabs)[number]>) =>
    set({
      ...faq,
      tabs: faq.tabs.map((t, i) => (i === at ? { ...t, ...patch } : t)),
    });
  const setSections = (sections: FaqSection[]) => setTab({ sections });
  const setSection = (k: number, patch: Partial<FaqSection>) =>
    setSections(tab.sections.map((s, i) => (i === k ? { ...s, ...patch } : s)));

  return (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm font-bold">
        Intro under the title (optional)
        <textarea
          value={faq.intro}
          maxLength={300}
          rows={2}
          onChange={(e) => set({ ...faq, intro: e.target.value })}
          className="rounded-xl border border-line bg-bg px-3 py-2 text-sm font-normal"
        />
      </label>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="FAQ tabs"
      >
        {faq.tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === at}
            onClick={() => setAt(i)}
            className={`min-h-9 rounded-full border px-3 text-sm font-bold ${i === at ? "border-[var(--lit-line)] text-accent" : "border-line text-muted"}`}
          >
            {t.title || "Untitled"}
          </button>
        ))}
        {faq.tabs.length < FAQ_LIMITS.tabs && (
          <button
            type="button"
            onClick={() => {
              set({
                ...faq,
                tabs: [
                  ...faq.tabs,
                  { id: uid("t"), title: "New tab", sections: [] },
                ],
              });
              setAt(faq.tabs.length);
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm text-muted"
          >
            <Plus className="size-4" aria-hidden /> Tab
          </button>
        )}
      </div>

      {tab && (
        <section className="grid gap-3 rounded-2xl border border-line p-3">
          <div className="flex items-end gap-2">
            <label className="grid flex-1 gap-1 text-sm font-bold">
              Tab name
              <input
                value={tab.title}
                maxLength={40}
                onChange={(e) => setTab({ title: e.target.value })}
                className={field}
              />
            </label>
            <button
              type="button"
              className={icon}
              aria-label="Move tab left"
              disabled={at === 0}
              onClick={() => {
                set({ ...faq, tabs: move(faq.tabs, at, -1) });
                setAt(at - 1);
              }}
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              className={icon}
              aria-label="Move tab right"
              disabled={at === faq.tabs.length - 1}
              onClick={() => {
                set({ ...faq, tabs: move(faq.tabs, at, 1) });
                setAt(at + 1);
              }}
            >
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              className={icon}
              aria-label="Remove tab"
              onClick={() => {
                if (
                  !confirm(
                    `Remove the “${tab.title}” tab and everything in it?`,
                  )
                )
                  return;
                set({ ...faq, tabs: faq.tabs.filter((_, i) => i !== at) });
                setAt(Math.max(0, at - 1));
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          {tab.sections.map((sec, k) => (
            <div
              key={sec.id}
              className="grid gap-2 rounded-xl border border-line p-3"
            >
              <div className="flex items-end gap-2">
                <label className="grid flex-1 gap-1 text-xs font-bold text-muted">
                  Category
                  <input
                    value={sec.title}
                    maxLength={80}
                    onChange={(e) => setSection(k, { title: e.target.value })}
                    className={field}
                  />
                </label>
                <button
                  type="button"
                  className={icon}
                  aria-label="Move category up"
                  disabled={k === 0}
                  onClick={() => setSections(move(tab.sections, k, -1))}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  className={icon}
                  aria-label="Move category down"
                  disabled={k === tab.sections.length - 1}
                  onClick={() => setSections(move(tab.sections, k, 1))}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className={icon}
                  aria-label="Remove category"
                  onClick={() =>
                    confirm(`Remove “${sec.title}” and its questions?`) &&
                    setSections(tab.sections.filter((_, i) => i !== k))
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {sec.items.map((it, j) => (
                <details key={it.id} className="rounded-lg border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-bold">
                    {it.q || "New question"}
                  </summary>
                  <div className="grid gap-2 px-3 pb-3">
                    <input
                      value={it.q}
                      maxLength={FAQ_LIMITS.q}
                      placeholder="Question"
                      aria-label="Question"
                      onChange={(e) =>
                        setSection(k, {
                          items: sec.items.map((x, i) =>
                            i === j ? { ...x, q: e.target.value } : x,
                          ),
                        })
                      }
                      className={field}
                    />
                    <textarea
                      value={it.a}
                      maxLength={FAQ_LIMITS.a}
                      rows={5}
                      placeholder="Answer"
                      aria-label="Answer"
                      onChange={(e) =>
                        setSection(k, {
                          items: sec.items.map((x, i) =>
                            i === j ? { ...x, a: e.target.value } : x,
                          ),
                        })
                      }
                      className="rounded-xl border border-line bg-bg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={icon}
                        aria-label="Move question up"
                        disabled={j === 0}
                        onClick={() =>
                          setSection(k, { items: move(sec.items, j, -1) })
                        }
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={icon}
                        aria-label="Move question down"
                        disabled={j === sec.items.length - 1}
                        onClick={() =>
                          setSection(k, { items: move(sec.items, j, 1) })
                        }
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={icon}
                        aria-label="Remove question"
                        onClick={() =>
                          setSection(k, {
                            items: sec.items.filter((_, i) => i !== j),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </details>
              ))}
              {sec.items.length < FAQ_LIMITS.items && (
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 justify-self-start rounded-lg border border-dashed border-line px-3 text-sm text-muted"
                  onClick={() =>
                    setSection(k, {
                      items: [...sec.items, { id: uid("q"), q: "", a: "" }],
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden /> Question
                </button>
              )}
            </div>
          ))}
          {tab.sections.length < FAQ_LIMITS.sections && (
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1 justify-self-start rounded-xl border border-dashed border-line px-3 text-sm text-muted"
              onClick={() =>
                setSections([
                  ...tab.sections,
                  { id: uid("s"), title: "New category", items: [] },
                ])
              }
            >
              <Plus className="size-4" aria-hidden /> Category
            </button>
          )}
        </section>
      )}

      <div className="sticky bottom-20 flex items-center gap-3 rounded-2xl border border-line bg-[var(--surface)] p-3">
        <Button
          type="button"
          variant="primary"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await saveFaq(JSON.stringify(faq));
              setStatus(r.error ?? "Saved. The FAQ page shows it now.");
              if (r.saved) setDirty(false);
            })
          }
        >
          {pending ? "Saving…" : "Save FAQ"}
        </Button>
        <span className="text-sm text-muted" role="status">
          {status ??
            (dirty
              ? "Unsaved changes. Questions without an answer aren't kept."
              : "Everything is saved.")}
        </span>
      </div>
    </div>
  );
}
