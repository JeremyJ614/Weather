/* eslint-disable @next/next/no-img-element -- a single small local logo */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-4 py-12">
      <img
        src="/brand/logo-primary.webp"
        alt="StormSync Media"
        width={240}
        height={71}
      />
      <h1
        className="text-4xl leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
      >
        StormSync Weather is being built
      </h1>
      <p style={{ color: "var(--muted)" }}>
        The app is under construction, one tested phase at a time. This page
        will become the Homepage when its phase is built.
      </p>
    </main>
  );
}
