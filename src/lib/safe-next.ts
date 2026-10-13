/** Only same-site paths may be used as a post-sign-in destination (no open redirects). */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}
