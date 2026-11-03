/* StormSync service worker.
   - The app's code files (hashed, never change) are kept in a capped cache, oldest out first,
     so phones don't fill up with every version ever shipped (review round, "sw-clean").
   - Pages and their data are always fetched live (Fix list 2026-10-30 #1: the old 1.5 s
     fallback showed stale copies on every slow engine map and kept asking for a refresh).
     Only when there is no connection at all is the copy from the last visit shown, and the
     page reloads by itself as soon as the connection is back. Warnings, alerts, account and
     payment calls are never answered from a saved copy. */
const SHELL = "sswx-shell-v2";
const STATIC = "sswx-static-v1";
const LAST = "sswx-last-v2";
const KEEP = [SHELL, STATIC, LAST];
const SHELL_FILES = [
  "/offline",
  "/icons/icon-192.png",
  "/brand/logo-primary.webp",
];
/** Caps (entries): code ~300 files, last-visit copies ~120 (about 15 MB at most). */
const MAX = { [STATIC]: 300, [LAST]: 120 };
/** Always live: warnings, alerts, lightning, storm reports, the account, billing, admin. */
const LIVE =
  /^\/api\/(warnings|notify|lightning|reports|me|auth|stripe|admin|cron|push|human|contact)(\/|$)|^\/(admin|auth|login|signup|welcome|version\.json)(\/|$)/;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => Promise.all([trim(STATIC), trim(LAST)]))
      .then(() => self.clients.claim()),
  );
});

/** Oldest entries out until the cache is at its cap (keys come back oldest first). */
async function trim(name) {
  const c = await caches.open(name);
  const keys = await c.keys();
  const extra = keys.length - MAX[name];
  for (let i = 0; i < extra; i++) await c.delete(keys[i]);
}

async function keep(name, req, res) {
  const c = await caches.open(name);
  // Re-adding moves an entry to the newest end.
  await c.delete(req);
  await c.put(req, res);
  await trim(name);
}

/** Tells a page its data came from the last visit because the network was gone. */
function noteOffline(clientId, savedAt) {
  if (!clientId) return;
  self.clients.get(clientId).then((c) => {
    if (c) c.postMessage({ type: "sswx-offline", savedAt });
  });
}

/**
 * Live, always. A good answer is saved (stamped with when) and returned. Only when the
 * network fails is the saved copy returned, and the page told it is offline.
 */
function liveOrLast(e, clientId) {
  const req = e.request;
  return fetch(req)
    .then((res) => {
      const type = res.headers.get("content-type") || "";
      if (
        res.ok &&
        res.type === "basic" &&
        (req.mode === "navigate" || type.includes("json"))
      ) {
        const h = new Headers(res.headers);
        h.set(
          "x-sswx-saved",
          String(Date.parse(res.headers.get("date") || "") || Date.now()),
        );
        e.waitUntil(
          res
            .clone()
            .blob()
            .then((b) =>
              keep(
                LAST,
                req,
                new Response(b, { status: res.status, headers: h }),
              ),
            )
            .catch(() => undefined),
        );
      }
      return res;
    })
    .catch(() =>
      caches
        .open(LAST)
        .then((c) => c.match(req))
        .then((hit) => {
          if (!hit)
            return req.mode === "navigate"
              ? caches.match("/offline")
              : Response.error();
          const at = Number(hit.headers.get("x-sswx-saved")) || 0;
          noteOffline(clientId, at);
          if (req.mode !== "navigate") return hit;
          // The page learns it came from a saved copy from a tag in its head.
          return hit.text().then(
            (html) =>
              new Response(
                html.replace(
                  "<head>",
                  `<head><meta name="sswx-saved" content="${at}">`,
                ),
                { status: hit.status, headers: hit.headers },
              ),
          );
        }),
    );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Signing out forgets the saved pages and data along with the account.
  if (req.method === "POST" && url.pathname === "/auth/signout") {
    e.waitUntil(caches.delete(LAST));
    return;
  }
  if (req.method !== "GET") return;
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              e.waitUntil(keep(STATIC, req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  // Images, scripts and the like go straight through; only pages and data calls are handled.
  if (req.destination && req.destination !== "document") return;
  if (LIVE.test(url.pathname)) {
    if (req.mode === "navigate")
      e.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }
  // Pages (but not the client router's data requests) and the app's own data calls.
  if (req.mode === "navigate") {
    e.respondWith(liveOrLast(e, e.resultingClientId));
    return;
  }
  if (url.pathname.startsWith("/api/") && !url.search.includes("nocache")) {
    e.respondWith(liveOrLast(e, e.clientId));
  }
});

// Daily Brief and alerts sent with Web Push.
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {}
  const title = data.title || "StormSync";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
      ...(data.tag ? { tag: data.tag } : {}),
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin)
    .href;
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const open = list.find((c) => c.url === url);
        return open ? open.focus() : self.clients.openWindow(url);
      }),
  );
});
