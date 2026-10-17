/** Turns on Web Push for this device and saves it to the member's account. */
export async function enablePush(): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "This browser can't receive notifications. On iPhone, add StormSync to your Home Screen first.";
  }
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Notifications aren't set up yet.";
  if ((await Notification.requestPermission()) !== "granted")
    return "Notifications are blocked in your browser settings.";
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
  if (!reg)
    return "Notifications need the installed app or a reload. Try again in a moment.";
  const raw = atob(
    key.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (key.length % 4)) % 4),
  );
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
  });
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  return res.ok ? null : "Couldn't turn on notifications. Try again.";
}

/** Whether this device already sends notifications to the account. */
export async function pushState(): Promise<
  "on" | "off" | "blocked" | "unsupported"
> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}
