/** Which SSWX News posts this device has opened. Unread = not opened and under 7 days old. */
const KEY = "sswx-read";
const EVENT = "sswx-read";
export const UNREAD_DAYS = 7;

let raw: string | null | undefined;
let ids: ReadonlySet<string> = new Set();
const EMPTY: ReadonlySet<string> = new Set();

export function readSet(): ReadonlySet<string> {
  let r: string | null = null;
  try {
    r = localStorage.getItem(KEY);
  } catch {
    return ids;
  }
  if (r !== raw) {
    raw = r;
    try {
      const arr = JSON.parse(r ?? "[]");
      ids = new Set(
        Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [],
      );
    } catch {
      ids = new Set();
    }
  }
  return ids;
}
export const serverReadSet = () => EMPTY;

export function markRead(id: string) {
  const next = [...readSet(), id].slice(-200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    ids = new Set(next);
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeRead(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function isUnread(
  post: { id: string; publish_at: string },
  read: ReadonlySet<string>,
  now = Date.now(),
) {
  return (
    !read.has(post.id) &&
    now - Date.parse(post.publish_at) < UNREAD_DAYS * 86400000
  );
}

/** Unread first (newest first within each group). */
export function orderPosts<T extends { id: string; publish_at: string }>(
  posts: T[],
  read: ReadonlySet<string>,
  now = Date.now(),
) {
  const by = (a: T, b: T) =>
    Date.parse(b.publish_at) - Date.parse(a.publish_at);
  const unread = posts.filter((p) => isUnread(p, read, now)).sort(by);
  const rest = posts.filter((p) => !isUnread(p, read, now)).sort(by);
  return { unread, rest };
}
