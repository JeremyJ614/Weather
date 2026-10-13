import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { STATES } from "@/lib/auth/signup";
import { CreateForm } from "./CreateForm";

export const metadata: Metadata = {
  title: "New member · Admin · StormSync Media",
};

export default async function NewMember() {
  await requireAdmin("members");
  return (
    <main className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">New member</h1>
        <p className="mt-1 text-sm text-muted">
          Creates a confirmed account. Set a PIN for them, or leave it empty and
          send a sign-in link so they choose their own.
        </p>
      </div>
      <CreateForm states={STATES} />
    </main>
  );
}
