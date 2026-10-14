"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { useViewer } from "@/features/account/useViewer";
import { myNotices, seenNotice, trackView, type Notice } from "./actions";
import s from "./Notices.module.css";

const TONE = { info: "var(--accent)", warning: "#fbbf24", alert: "#f87171" };
const ICON = { info: Info, warning: TriangleAlert, alert: CircleAlert };

/** Admin notices as pop-ups (until closed), and the page-usage counter. Members only. */
export function Notices() {
  const { signedIn } = useViewer();
  const path = usePathname();
  const [list, setList] = useState<Notice[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const load = () =>
      myNotices()
        .then((n) => live && setList(n))
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || path.startsWith("/admin")) return;
    trackView(path.split("/")[1] ?? "").catch(() => {});
  }, [signedIn, path]);

  if (!list.length) return null;
  return (
    <div className={s.stack} role="region" aria-label="Notifications">
      {list.slice(0, 3).map((n) => {
        const I = ICON[n.level];
        return (
          <div
            key={n.id}
            role="status"
            className={s.toast}
            style={{ ["--tone" as string]: TONE[n.level] }}
          >
            <I aria-hidden />
            <div>
              <b>{n.title}</b>
              {n.body && <p>{n.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              className={s.x}
              onClick={() => {
                setList((l) => l.filter((x) => x.id !== n.id));
                seenNotice(n.id).catch(() => {});
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
