import "server-only";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { canSeeSswx } from "./store";

/** The SSWX pages answer 404 to anyone who isn't a Member, Recruit or admin. */
export async function requireSswx() {
  const v = await getViewer();
  if (!canSeeSswx(v)) notFound();
  return v;
}
