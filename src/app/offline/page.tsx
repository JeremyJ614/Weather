/* eslint-disable @next/next/no-img-element -- cached local logo */
import { pageMeta } from "@/lib/seo/site";

export const metadata = pageMeta(
  "/offline",
  "Offline",
  "You're offline. StormSync Weather keeps working with what it saved.",
  { noindex: true },
);

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
      <img
        src="/brand/logo-primary.webp"
        alt="StormSync Media"
        width={220}
        height={65}
        className="mx-auto"
      />
      <h1
        className="text-3xl"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        You&apos;re offline
      </h1>
      <p style={{ color: "var(--muted)" }}>
        Weather data needs a connection. Reconnect and pull down to refresh;
        nothing you saved is lost.
      </p>
    </main>
  );
}
