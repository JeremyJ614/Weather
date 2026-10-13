"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { refreshWeatherNews, WEATHER_NEWS_TAG } from "@/lib/news/store";

const done = () => {
  updateTag(WEATHER_NEWS_TAG);
  revalidatePath("/admin/stories");
};

/** pin | unpin | hide | unhide | up | down */
export async function curateStory(fd: FormData) {
  const { supabase } = await requireAdmin("news");
  const url = String(fd.get("url") ?? "").slice(0, 500);
  const op = String(fd.get("op") ?? "");
  if (!/^https?:\/\//.test(url)) return;
  const { data: pins } = await supabase
    .from("news_curation")
    .select("url, position")
    .eq("action", "pin")
    .order("position");
  const list = (pins ?? []).map((p) => p.url);

  if (op === "pin" || op === "hide") {
    await supabase
      .from("news_curation")
      .upsert({ url, action: op, position: op === "pin" ? list.length : 0 });
  } else if (op === "unpin" || op === "unhide") {
    await supabase.from("news_curation").delete().eq("url", url);
  } else if (op === "up" || op === "down") {
    const i = list.indexOf(url);
    const j = op === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(
      list.map((u, k) =>
        supabase.from("news_curation").update({ position: k }).eq("url", u),
      ),
    );
  } else return;
  await supabase.rpc("log_admin", { p_action: `story_${op}`, p_target: url });
  done();
}

export type RefreshState = { error?: string; message?: string } | null;

export async function refreshNow(): Promise<RefreshState> {
  const { supabase } = await requireAdmin("news");
  try {
    const r = await refreshWeatherNews();
    await supabase.rpc("log_admin", {
      p_action: "refresh_weather_news",
      p_target: `${r.saved} stories`,
    });
    done();
    return {
      message: `Collected ${r.saved} stories${r.failed.length ? `; unavailable: ${r.failed.join(", ")}` : ""}.`,
    };
  } catch (e) {
    return { error: `Collection failed: ${(e as Error).message}` };
  }
}
