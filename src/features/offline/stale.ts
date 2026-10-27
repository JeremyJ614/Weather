/**
 * Instant reopen's label (review round): when the network was slow or gone and the service
 * worker showed this page's last-seen copy, say how old it is, and offer a refresh once newer
 * data has arrived. Plain DOM and loaded only when a service worker controls the page, so it
 * costs every other page nothing.
 */
const ago = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60
    ? `${m} min ago`
    : m < 1440
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} days ago`;
};

export function watchStale(sw: ServiceWorkerContainer) {
  let box: HTMLDivElement | null = null;
  const show = (text: string) => {
    if (!box) {
      box = document.createElement("div");
      box.setAttribute("role", "status");
      box.className =
        "fixed top-[calc(env(safe-area-inset-top,0px)+64px)] left-1/2 z-[70] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--lit-line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-text shadow-lg";
      const span = document.createElement("span");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "text-accent";
      btn.textContent = "Refresh";
      btn.onclick = () => location.reload();
      box.append(span, btn);
      document.body.append(box);
    }
    box.firstChild!.textContent = text;
  };
  sw.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type === "sswx-stale")
      show(
        `Slow connection: showing what you saw ${e.data.savedAt ? ago(e.data.savedAt) : "last time"}`,
      );
    if (e.data?.type === "sswx-fresh" && box) show("Newer data is ready");
  });
  // This page itself came from a saved copy: the worker tags its head with when.
  const mark = document.querySelector<HTMLMetaElement>(
    'meta[name="sswx-saved"]',
  );
  if (mark)
    show(
      `Slow connection: showing what you saw ${Number(mark.content) ? ago(Number(mark.content)) : "last time"}`,
    );
  sw.controller?.postMessage({ type: "sswx-stale?" });
}
