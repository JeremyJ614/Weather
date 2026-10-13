"use client";

/** A row of choice chips that scrolls sideways on phones. */
export function Chips<T extends string | number>({
  items,
  value,
  onPick,
}: {
  items: { id: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((it) => (
        <button
          key={String(it.id)}
          onClick={() => onPick(it.id)}
          aria-pressed={it.id === value}
          className="min-h-9 flex-none rounded-full border border-line bg-surface px-3 text-sm font-bold text-muted aria-pressed:border-accent aria-pressed:bg-lit aria-pressed:text-accent"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
