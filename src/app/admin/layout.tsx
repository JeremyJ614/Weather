import type { Metadata } from "next";

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
  return children;
}
