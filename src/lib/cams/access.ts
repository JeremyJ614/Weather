import "server-only";
import { getRealViewer } from "@/lib/auth/viewer";
import { CAMS_OPEN } from "./style";

/** Owner-only until approved: the founder, or every member once `CAMS_OPEN` is on. */
export async function canSeeCams() {
  const v = await getRealViewer();
  return v.roles.includes("founder") || (CAMS_OPEN && v.signedIn);
}
