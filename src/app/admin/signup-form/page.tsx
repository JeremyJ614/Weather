import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getSignupForm } from "@/lib/auth/signup-form";
import { FormEditor } from "./FormEditor";

export const metadata: Metadata = {
  title: "Signup form · Admin · StormSync Media",
};

export default async function SignupFormAdmin() {
  await requireAdmin("signup-form");
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Signup form</h1>
      <FormEditor form={await getSignupForm()} />
    </main>
  );
}
