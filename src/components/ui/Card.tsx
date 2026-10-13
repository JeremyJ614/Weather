import type { HTMLAttributes } from "react";

/** The default container: dark glass with a hairline primary rule along the top. */
export function Card({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel rounded-2xl p-4 ${className}`} {...rest} />;
}
