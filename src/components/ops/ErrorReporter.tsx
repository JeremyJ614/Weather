"use client";

import { useEffect } from "react";

const MAX_PER_PAGE = 5;

function fingerprint(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** Sends uncaught browser errors to the admin error inbox (grouped, a few per page view). */
export function ErrorReporter() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let sent = 0;
    const seen = new Set<string>();
    const report = (message: string, stack = "") => {
      const page = location.pathname.replace(/[0-9a-f-]{36}/g, ":id");
      const fp = fingerprint(`${message}|${page}`);
      if (sent >= MAX_PER_PAGE || seen.has(fp)) return;
      seen.add(fp);
      sent++;
      const device = `${document.documentElement.dataset.tier ?? "?"}-tier ${/Mobi/.test(navigator.userAgent) ? "phone" : "desktop"}`;
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
          p_device: device,
          p_stack: stack,
        }),
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) =>
      report(e.message || "Script error", e.error?.stack);
    const onReject = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(
        r instanceof Error ? r.message : String(r).slice(0, 300),
        r instanceof Error ? r.stack : "",
      );
    };
    addEventListener("error", onError);
    addEventListener("unhandledrejection", onReject);
    return () => {
      removeEventListener("error", onError);
      removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}
