import { getViewer } from "@/lib/auth/viewer";

/** The signed-in viewer's name and roles, for client UI (menus). Never cached. */
export async function GET() {
  return Response.json(await getViewer(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
