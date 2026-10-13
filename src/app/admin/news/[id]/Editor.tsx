"use client";

import { useActionState, useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fromMarkdown, type Doc } from "@/lib/news/doc";
import { RichEditor } from "./RichEditor";
import { deleteNews, saveNews } from "../actions";

type Post = {
  title: string;
  body: string;
  doc: Doc | null;
  updated_at: string | null;
  cover_path: string | null;
  status: string;
  publish_at: string | null;
};
const field = "w-full rounded-xl border border-line bg-bg px-3";
/** Shrinks a photo on the phone (max 1600 px, WebP) so uploads stay small. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, fail) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : fail(new Error("Image could not be read"))),
      "image/webp",
      0.82,
    ),
  );
}

const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export function Editor({
  id,
  post,
  imageBase,
  initialMode,
}: {
  id: string;
  post: Post | null;
  imageBase: string;
  initialMode: "draft" | "now" | "schedule";
}) {
  const [state, action, pending] = useActionState(saveNews, null);
  const [cover, setCover] = useState(post?.cover_path ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<string>(initialMode);
  const [when, setWhen] = useState(localInput(post?.publish_at ?? null));
  const [initial] = useState<Doc | null>(() =>
    post ? (post.doc ?? fromMarkdown(post.body)) : null,
  );

  // A saved post no longer needs its local autosave.
  useEffect(() => {
    if (!state?.saved) return;
    try {
      localStorage.removeItem(`sswx-news-draft:${id}`);
    } catch {
      /* private mode */
    }
  }, [state, id]);

  /** Shrinks and stores an image for this post; returns its public address. */
  const send = async (file: File) => {
    const blob = await shrink(file);
    const res = await fetch(`/api/admin/news-image?post=${id}`, {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body: blob,
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error ?? "Upload failed");
    return out as { path: string; url: string };
  };
  const upload = async (file: File, asCover: boolean) => {
    setBusy("cover");
    try {
      const out = await send(file);
      if (asCover) setCover(out.path);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickFile = (asCover: boolean) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => input.files?.[0] && upload(input.files[0], asCover);
    input.click();
  };

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cover" value={cover} />
      <input
        type="hidden"
        name="publishAt"
        value={when ? new Date(when).toISOString() : ""}
      />
      <input
        name="title"
        defaultValue={post?.title}
        required
        maxLength={140}
        placeholder="Title"
        aria-label="Title"
        className={`${field} display min-h-12 text-xl`}
      />

      <div className="grid gap-2">
        {cover ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- our resized upload */}
            <img
              src={imageBase + cover}
              alt="Cover"
              className="aspect-[16/9] w-full rounded-xl border border-line object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCover("")}
              className="absolute top-2 right-2"
            >
              Remove cover
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => pickFile(true)}
            disabled={busy !== null}
          >
            <ImagePlus className="size-4" aria-hidden />{" "}
            {busy === "cover" ? "Uploading…" : "Add cover image"}
          </Button>
        )}
      </div>

      <RichEditor
        postId={id}
        initial={initial}
        savedAt={post?.updated_at ?? null}
        upload={async (f) => (await send(f)).url}
        onBusy={(b) => setBusy(b ? "image" : null)}
      />
      {busy === "image" && (
        <p className="text-sm text-muted" role="status">
          Uploading image…
        </p>
      )}

      <fieldset className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Publishing</legend>
        {[
          ["draft", "Save as draft"],
          ["now", post?.status === "published" ? "Published" : "Publish now"],
          ["schedule", "Schedule"],
        ].map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              value={v}
              checked={mode === v}
              onChange={() => setMode(v)}
              className="accent-[var(--accent)]"
            />
            {label}
          </label>
        ))}
        {mode === "schedule" && (
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            required
            aria-label="Publish at"
            className={`${field} min-h-11`}
          />
        )}
      </fieldset>

      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? "Saved."}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || busy !== null}
          className="flex-1"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        {post && (
          <Button
            type="submit"
            formAction={deleteNews}
            formNoValidate
            variant="ghost"
            className="text-accent"
            onClick={(e) => {
              if (!confirm("Delete this post and its images?"))
                e.preventDefault();
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
      </div>
    </form>
  );
}
