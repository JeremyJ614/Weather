"use client";

import { useEffect } from "react";

/** Sends uncaught browser errors to the admin error inbox (grouped, up to five per page view). */
export function ErrorReporter() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const seen = new Set<string>();
    const report = (r: unknown) => {
      const message =
        r instanceof Error
          ? r.message
          : String(r || "Script error").slice(0, 300);
      const page = location.pathname.replace(/[0-9a-f-]{36}/g, ":id");
      let h = 5381;
      for (const c of `${message}|${page}`)
        h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
      const fp = h.toString(16);
      if (seen.size >= 5 || seen.has(fp)) return;
      seen.add(fp);
      fetch(`${url}/rest/v1/rpc/report_error`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_fp: fp,
          p_message: message,
          p_page: page,
          p_device: `${document.documentElement.dataset.tier ?? "?"}-tier ${/Mobi/.test(navigator.userAgent) ? "phone" : "desktop"}`,
          p_stack: r instanceof Error ? (r.stack ?? "") : "",
        }),
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => report(e.error ?? e.message);
    const onReject = (e: PromiseRejectionEvent) => report(e.reason);
    addEventListener("error", onError);
    addEventListener("unhandledrejection", onReject);
    return () => {
      removeEventListener("error", onError);
      removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}
