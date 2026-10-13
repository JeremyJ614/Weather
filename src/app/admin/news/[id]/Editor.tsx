"use client";

import { useActionState, useRef, useState } from "react";
import {
  Bold,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Pencil,
  Quote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NewsBody } from "@/lib/news/markdown";
import { deleteNews, saveNews } from "../actions";

type Post = {
  title: string;
  body: string;
  cover_path: string | null;
  status: string;
  publish_at: string | null;
};
const field = "w-full rounded-xl border border-line bg-bg px-3";
const TOOLS = [
  { id: "bold", label: "Bold", Icon: Bold },
  { id: "italic", label: "Italic", Icon: Italic },
  { id: "h2", label: "Heading", Icon: Heading2 },
  { id: "list", label: "List", Icon: List },
  { id: "quote", label: "Quote", Icon: Quote },
  { id: "link", label: "Link", Icon: Link2 },
  { id: "image", label: "Image", Icon: ImagePlus },
] as const;

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
  const [body, setBody] = useState(post?.body ?? "");
  const [cover, setCover] = useState(post?.cover_path ?? "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<string>(initialMode);
  const [when, setWhen] = useState(localInput(post?.publish_at ?? null));
  const area = useRef<HTMLTextAreaElement>(null);

  const insert = (before: string, after = "", placeholder = "") => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const picked = body.slice(s, e) || placeholder;
    setBody(body.slice(0, s) + before + picked + after + body.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        s + before.length,
        s + before.length + picked.length,
      );
    });
  };
  const line = (prefix: string) => {
    const el = area.current;
    const s = el?.selectionStart ?? body.length;
    const start = body.lastIndexOf("\n", s - 1) + 1;
    setBody(body.slice(0, start) + prefix + body.slice(start));
  };

  const upload = async (file: File, asCover: boolean) => {
    setBusy(asCover ? "cover" : "image");
    try {
      const blob = await shrink(file);
      const res = await fetch(`/api/admin/news-image?post=${id}`, {
        method: "POST",
        headers: { "Content-Type": "image/webp" },
        body: blob,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Upload failed");
      if (asCover) setCover(out.path);
      else
        insert(
          `\n![${file.name.replace(/\.[^.]+$/, "").slice(0, 60)}](${out.url})\n`,
        );
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

  const runTool = (tool: (typeof TOOLS)[number]["id"]) => {
    if (tool === "bold") insert("**", "**", "bold");
    else if (tool === "italic") insert("*", "*", "italic");
    else if (tool === "h2") line("## ");
    else if (tool === "list") line("- ");
    else if (tool === "quote") line("> ");
    else if (tool === "link") insert("[", "](https://)", "link text");
    else pickFile(false);
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

      <div className="grid gap-2">
        <div
          className="flex flex-wrap items-center gap-1"
          role="toolbar"
          aria-label="Formatting"
        >
          {TOOLS.map(({ id: tool, label, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => runTool(tool)}
              disabled={preview || busy !== null}
              aria-label={label}
              className="grid size-10 place-items-center rounded-lg border border-line bg-surface text-accent disabled:opacity-40"
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="ml-auto flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-bold"
          >
            {preview ? (
              <Pencil className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        {busy === "image" && (
          <p className="text-sm text-muted">Uploading image…</p>
        )}
        <textarea
          ref={area}
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          rows={14}
          aria-label="Post"
          placeholder="Write the post. Use the buttons for bold, headings, lists, links and images."
          className={`${field} py-3 leading-relaxed ${preview ? "hidden" : ""}`}
        />
        {preview && (
          <div className="min-h-40 rounded-xl border border-line bg-surface p-4">
            <NewsBody source={body} />
          </div>
        )}
      </div>

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
