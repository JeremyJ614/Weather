/**
 * Always fresh (Fix list 2026-10-30 #1). Two jobs, both silent:
 * - When a new version of the app ships, the page reloads itself onto it: at once, or as soon
 *   as the person stops typing. The build stamp is baked in at build time and compared with
 *   /version.json (a static file, so checking costs no server time).
 * - When the network was gone and the service worker showed the last visit's copy, a quiet
 *   label says so, and the page reloads itself the moment the connection is back.
 * Plain DOM, loaded after the page.
 */
const BUILD = process.env.SSWX_BUILD ?? "";
const EVERY_MS = 5 * 60_000;

const ago = (t: number) => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60000));
  return m < 60
    ? `${m} min ago`
    : m < 1440
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} days ago`;
};

const typing = () => {
  const a = document.activeElement as HTMLElement | null;
  return Boolean(
    a &&
    (a.isContentEditable ||
      (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) &&
        (a as HTMLInputElement).type !== "checkbox" &&
        (a as HTMLInputElement).type !== "radio")),
  );
};

export function watchFresh(sw: ServiceWorkerContainer) {
  let reloading = false;
  let waiting = false;
  const reload = async () => {
    if (reloading) return;
    if (typing()) {
      waiting = true;
      return;
    }
    reloading = true;
    // Pick up the new service worker too, then load the new version.
    await sw
      .getRegistration()
      .then((r) => r?.update())
      .catch(() => undefined);
    location.reload();
  };
  addEventListener("focusout", () => waiting && setTimeout(reload, 300));

  const check = async () => {
    if (!BUILD || BUILD === "dev" || !navigator.onLine) return;
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const { id } = (await r.json()) as { id?: string };
      if (id && id !== BUILD) reload();
    } catch {
      // Offline or between deploys: the next check tries again.
    }
  };
  check();
  setInterval(
    () => document.visibilityState === "visible" && check(),
    EVERY_MS,
  );
  document.addEventListener(
    "visibilitychange",
    () => document.visibilityState === "visible" && check(),
  );

  // A new service worker took over this page: it came with a new version.
  const had = Boolean(sw.controller);
  sw.addEventListener("controllerchange", () => had && reload());

  // Offline copy: say how old it is, and reload once the connection returns.
  let box: HTMLDivElement | null = null;
  const offline = (savedAt: number) => {
    if (!box) {
      box = document.createElement("div");
      box.setAttribute("role", "status");
      box.className =
        "pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+64px)] left-1/2 z-[70] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full border border-[var(--lit-line)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-text shadow-lg";
      document.body.append(box);
    }
    box.textContent = `Offline: showing what you saw ${savedAt ? ago(savedAt) : "last time"}. It updates by itself when you reconnect.`;
  };
  sw.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type === "sswx-offline") offline(Number(e.data.savedAt) || 0);
  });
  const mark = document.querySelector<HTMLMetaElement>(
    'meta[name="sswx-saved"]',
  );
  if (mark) offline(Number(mark.content) || 0);
  addEventListener("online", () => box && reload());
}
