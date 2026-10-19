import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getFaq } from "@/lib/help/faq";
import { FaqEditor } from "./FaqEditor";

export const metadata: Metadata = { title: "FAQ · Admin · StormSync Media" };

export default async function FaqAdmin() {
  await requireAdmin("faq");
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">FAQ</h1>
      <p className="text-sm text-muted">
        Tabs across the top of the FAQ page, categories inside each tab, and the
        questions in each category. In an answer, a blank line starts a new
        paragraph and [words](/page) makes a link.
      </p>
      <FaqEditor faq={await getFaq()} />
    </main>
  );
}
