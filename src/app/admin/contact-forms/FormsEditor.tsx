"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  FIELD_KINDS,
  FORM_LIMITS,
  type ContactForms,
  type ContactTab,
  type FieldKind,
  type FormField,
} from "@/lib/help/forms";
import { saveContactForms } from "./actions";

const field =
  "min-h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm";
const icon =
  "grid size-9 place-items-center rounded-lg border border-line text-muted disabled:opacity-30";
const move = <T,>(l: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= l.length) return l;
  const o = [...l];
  [o[i], o[j]] = [o[j], o[i]];
  return o;
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

/** The Contact Us tabs and each one's fields: add, rename, reorder, switch off and remove. */
export function FormsEditor({ forms: initial }: { forms: ContactForms }) {
  const [tabs, setTabs] = useState(initial.tabs);
  const [at, setAt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (next: ContactTab[]) => {
    setTabs(next);
    setDirty(true);
    setStatus(null);
  };
  const tab = tabs[at];
  const setTab = (patch: Partial<ContactTab>) =>
    set(tabs.map((t, i) => (i === at ? { ...t, ...patch } : t)));
  const setField = (k: number, patch: Partial<FormField>) =>
    setTab({
      fields: tab.fields.map((f, i) => (i === k ? { ...f, ...patch } : f)),
    });
  const bodyAt = tab?.fields.findIndex((f) => f.id === "body") ?? -1;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Forms">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === at}
            onClick={() => setAt(i)}
            className={`min-h-9 rounded-full border px-3 text-sm font-bold ${i === at ? "border-[var(--lit-line)] text-accent" : "border-line text-muted"} ${t.on ? "" : "line-through opacity-60"}`}
          >
            {t.title || "Untitled"}
          </button>
        ))}
        {tabs.length < FORM_LIMITS.tabs && (
          <button
            type="button"
            onClick={() => {
              let id = "new-form";
              for (let n = 2; tabs.some((t) => t.id === id); n++)
                id = `new-form-${n}`;
              set([
                ...tabs,
                {
                  id,
                  title: "New form",
                  intro: "",
                  on: true,
                  fields: [
                    {
                      id: "name",
                      label: "Your name",
                      kind: "text",
                      required: true,
                      options: [],
                      placeholder: "",
                      locked: "name",
                    },
                    {
                      id: "email",
                      label: "Your email",
                      kind: "email",
                      required: true,
                      options: [],
                      placeholder: "",
                      locked: "email",
                    },
                    {
                      id: "body",
                      label: "Your message",
                      kind: "long",
                      required: true,
                      options: [],
                      placeholder: "",
                      locked: "body",
                    },
                  ],
                },
              ]);
              setAt(tabs.length);
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm text-muted"
          >
            <Plus className="size-4" aria-hidden /> Form
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
                maxLength={30}
                onChange={(e) => setTab({ title: e.target.value })}
                onBlur={(e) =>
                  tab.id.startsWith("new-form") &&
                  slug(e.target.value) &&
                  !tabs.some(
                    (t, i) => i !== at && t.id === slug(e.target.value),
                  ) &&
                  setTab({ id: slug(e.target.value) })
                }
                className={field}
              />
            </label>
            <button
              type="button"
              className={icon}
              aria-label="Move form left"
              disabled={at === 0}
              onClick={() => {
                set(move(tabs, at, -1));
                setAt(at - 1);
              }}
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              className={icon}
              aria-label="Move form right"
              disabled={at === tabs.length - 1}
              onClick={() => {
                set(move(tabs, at, 1));
                setAt(at + 1);
              }}
            >
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              className={icon}
              aria-label="Remove form"
              disabled={tabs.length === 1}
              onClick={() => {
                if (
                  !confirm(
                    `Remove the “${tab.title}” form? Messages already sent stay in the inbox.`,
                  )
                )
                  return;
                set(tabs.filter((_, i) => i !== at));
                setAt(Math.max(0, at - 1));
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted">
            Inbox tag: <code>{tab.id}</code>
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tab.on}
              onChange={(e) => setTab({ on: e.target.checked })}
            />
            Show this form on the Contact Us page
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Note above the form (optional)
            <textarea
              value={tab.intro}
              maxLength={300}
              rows={2}
              onChange={(e) => setTab({ intro: e.target.value })}
              className="rounded-xl border border-line bg-bg px-3 py-2 text-sm font-normal"
            />
          </label>

          {tab.fields.map((f, k) => (
            <div
              key={f.id}
              className="grid gap-2 rounded-xl border border-line p-3"
            >
              <div className="flex items-end gap-2">
                <label className="grid flex-1 gap-1 text-xs font-bold text-muted">
                  <span className="inline-flex items-center gap-1">
                    {f.locked && (
                      <Lock className="size-3" aria-label="Always asked" />
                    )}
                    Question
                  </span>
                  <input
                    value={f.label}
                    maxLength={80}
                    onChange={(e) => setField(k, { label: e.target.value })}
                    className={field}
                  />
                </label>
                <button
                  type="button"
                  className={icon}
                  aria-label="Move up"
                  disabled={k === 0}
                  onClick={() => setTab({ fields: move(tab.fields, k, -1) })}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  className={icon}
                  aria-label="Move down"
                  disabled={k === tab.fields.length - 1}
                  onClick={() => setTab({ fields: move(tab.fields, k, 1) })}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className={icon}
                  aria-label="Remove question"
                  disabled={Boolean(f.locked)}
                  onClick={() =>
                    setTab({ fields: tab.fields.filter((_, i) => i !== k) })
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {!f.locked && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={f.kind}
                    aria-label="Answer type"
                    onChange={(e) =>
                      setField(k, {
                        kind: e.target.value as FieldKind,
                        options:
                          e.target.value === "choice" && !f.options.length
                            ? ["Option 1", "Option 2"]
                            : f.options,
                      })
                    }
                    className={field}
                  >
                    {FIELD_KINDS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) =>
                        setField(k, { required: e.target.checked })
                      }
                    />
                    Required
                  </label>
                </div>
              )}
              {f.kind === "choice" && !f.locked && (
                <label className="grid gap-1 text-xs font-bold text-muted">
                  Choices, one per line
                  <textarea
                    value={f.options.join("\n")}
                    rows={Math.min(8, f.options.length + 1)}
                    onChange={(e) =>
                      setField(k, {
                        options: e.target.value
                          .split("\n")
                          .slice(0, FORM_LIMITS.options),
                      })
                    }
                    className="rounded-xl border border-line bg-bg px-3 py-2 text-sm font-normal"
                  />
                </label>
              )}
              {f.kind !== "choice" && f.kind !== "yesno" && (
                <input
                  value={f.placeholder}
                  maxLength={80}
                  placeholder="Hint inside the box (optional)"
                  aria-label="Hint inside the box"
                  onChange={(e) => setField(k, { placeholder: e.target.value })}
                  className={field}
                />
              )}
            </div>
          ))}
          {tab.fields.length < FORM_LIMITS.fields && (
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1 justify-self-start rounded-xl border border-dashed border-line px-3 text-sm text-muted"
              onClick={() => {
                const f: FormField = {
                  id: `q${Date.now().toString(36)}`,
                  label: "New question",
                  kind: "text",
                  required: false,
                  options: [],
                  placeholder: "",
                };
                const i = bodyAt < 0 ? tab.fields.length : bodyAt;
                setTab({
                  fields: [
                    ...tab.fields.slice(0, i),
                    f,
                    ...tab.fields.slice(i),
                  ],
                });
              }}
            >
              <Plus className="size-4" aria-hidden /> Question
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
              const r = await saveContactForms(
                JSON.stringify({
                  tabs: tabs.map((t) => ({
                    ...t,
                    fields: t.fields.map((f) => ({
                      ...f,
                      options: f.options.map((o) => o.trim()).filter(Boolean),
                    })),
                  })),
                }),
              );
              setStatus(r.error ?? "Saved. The Contact Us page shows it now.");
              if (r.saved) setDirty(false);
            })
          }
        >
          {pending ? "Saving…" : "Save forms"}
        </Button>
        <span className="text-sm text-muted" role="status">
          {status ?? (dirty ? "Unsaved changes." : "Everything is saved.")}
        </span>
      </div>
    </div>
  );
}
