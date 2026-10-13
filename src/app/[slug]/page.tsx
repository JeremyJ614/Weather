import { notFound } from "next/navigation";
import { PhaseNotice } from "@/components/PhaseNotice";
import { ALL_PAGES } from "@/lib/nav/registry";

export const dynamicParams = false;

// Pages that have their own route now.
const BUILT = new Set(["login", "admin", "dashboard", "daily-brief"]);

export function generateStaticParams() {
  return ALL_PAGES.filter((p) => p.slug && !BUILT.has(p.slug)).map((p) => ({
    slug: p.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = ALL_PAGES.find((p) => p.slug === slug);
  return {
    title: page ? `${page.label} · StormSync Media` : "StormSync Media",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = ALL_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  return <PhaseNotice page={page.label} phase={page.phase} />;
}
