/**
 * "Remember this device": sessions normally persist (long-lived cookies). When a member
 * unticks it, the session cookies are written without an expiry so they end with the browser.
 */
export const REMEMBER_COOKIE = "sswx-remember";

type Opts = { maxAge?: number; expires?: Date | number | string } & Record<
  string,
  unknown
>;

export function sessionOptions<T extends Opts>(
  remember: string | undefined,
  o: T,
): T {
  if (remember !== "0") return o;
  const { maxAge: _m, expires: _e, ...rest } = o;
  void _m;
  void _e;
  return rest as T;
}
