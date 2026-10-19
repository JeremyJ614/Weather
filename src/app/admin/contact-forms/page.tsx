import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getContactForms } from "@/lib/help/forms";
import { FormsEditor } from "./FormsEditor";

export const metadata: Metadata = {
  title: "Contact forms · Admin · StormSync Media",
};

export default async function ContactFormsAdmin() {
  await requireAdmin("contact-forms");
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Contact forms</h1>
      <p className="text-sm text-muted">
        Each form is a tab on the Contact Us page. Every message lands in{" "}
        <Link href="/admin/inbox" className="text-accent underline">
          Contact inbox
        </Link>{" "}
        tagged with its form, and you get a notice, a push and an email. Every
        form asks for a name, an email and a message; you can rename those and
        add anything else.
      </p>
      <FormsEditor forms={await getContactForms()} />
    </main>
  );
}
