import type { Metadata } from "next";
import s from "./AdminPhone.module.css";

/** Admin pages keep their own full titles and stay out of search. */
export const metadata: Metadata = {
  title: { template: "%s", default: "Admin · StormSync Media" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={s.admin}>{children}</div>;
}
