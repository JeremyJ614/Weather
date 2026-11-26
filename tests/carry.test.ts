import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const env = { supabaseUrl: "https://katgjzkvscexswsqqooi.supabase.co" };
vi.mock("@/lib/env", () => ({ publicEnv: () => env }));
const rpc = vi.fn();
const update = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc, auth: { admin: { updateUserById: update } } }),
}));
import { carryPassword } from "@/lib/auth/carry";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

describe("sign-in carry-over after the project move", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    rpc.mockResolvedValue({ data: true });
    update.mockResolvedValue({ error: null });
    env.supabaseUrl = "https://katgjzkvscexswsqqooi.supabase.co";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  it("copies a password the old project accepts, under the same id", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ access_token: "t", user: { id: "u1", email: "A@b.co" } }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await carryPassword("a@b.co", "pw")).toBe(true);
    expect(update).toHaveBeenCalledWith("u1", { password: "pw" });
    // The session the old project opened is ended.
    expect(String(fetchMock.mock.calls[1][0])).toContain("/auth/v1/logout");
  });
  it("never replaces a password the new project already has", async () => {
    rpc.mockResolvedValue({ data: false });
    expect(await carryPassword("a@b.co", "pw")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it("copies nothing when the old project refuses", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 400 }));
    expect(await carryPassword("a@b.co", "bad")).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
  it("copies nothing for a different account's answer", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ access_token: "t", user: { id: "u2", email: "x@y.co" } }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await carryPassword("a@b.co", "pw")).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
  it("stays off while the site still runs on the old project", async () => {
    env.supabaseUrl = "https://ztzqemzuanwqwqzsaigd.supabase.co";
    expect(await carryPassword("a@b.co", "pw")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
