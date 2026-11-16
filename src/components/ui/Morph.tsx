import * as React from "react";

// React's <ViewTransition> ships in the React build Next.js uses for the App Router; plain
// React (tests) doesn't have it yet, so the wrapper simply renders its children there.
const VT = (React as { ViewTransition?: typeof React.ViewTransition })
  .ViewTransition;

/**
 * Card grows into the page (post-launch A5 "card-morph"): an element with the same `name` on
 * the old and the new page morphs from one place to the other during navigation.
 */
export function Morph({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return VT ? (
    <VT name={name} share="morph" default="none">
      {children}
    </VT>
  ) : (
    <>{children}</>
  );
}
