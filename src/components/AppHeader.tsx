/* eslint-disable @next/next/no-img-element -- small local logo */
import Link from "next/link";

/** Logo in the top-center zone, which no menu style uses. */
export function AppHeader() {
  return (
    <header
      id="app-header"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[calc(14px+env(safe-area-inset-top,0px))]"
    >
      <Link
        href="/"
        className="pointer-events-auto"
        aria-label="StormSync Media home"
      >
        <img src="/brand/logo-primary.webp" alt="" width={118} height={35} />
      </Link>
    </header>
  );
}
