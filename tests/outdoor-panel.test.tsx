import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/features/engines/report-actions", () => ({ sendReport: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ supabaseBrowser: vi.fn() }));
import {
  PlacePanel,
  ReportBox,
  ReportSummary,
} from "@/features/engines/OutdoorPanel";

const hours = Array.from({ length: 72 }, (_, i) => ({
  t: Date.UTC(2026, 9, 24, i),
  v: (i * 7) % 100,
}));

describe("outdoor panel", () => {
  it("shows a place's deer outlook with legal hours and the season", () => {
    render(
      <PlacePanel
        kind="deer"
        label="Columbus, OH"
        color={() => "#fff"}
        data={{
          at: "",
          hours,
          best: [{ day: "Sun", from: "7:00 AM", v: 81 }],
          now: 30,
          season: ["Archery"],
          state: "Ohio",
          legal: { from: "7:23 AM", to: "7:10 PM" },
          stand:
            "Wind from the E at 2 mph: set up on the W (downwind) side of trails and bedding.",
          colder: 8,
          rut: 1.25,
        }}
      />,
    );
    expect(screen.getByText(/Legal shooting hours today/)).toBeTruthy();
    expect(screen.getByText(/Archery/)).toBeTruthy();
    expect(screen.getByText(/pre-rut/)).toBeTruthy();
    expect(screen.getByText(/Sun 7:00 AM \(81\)/)).toBeTruthy();
  });
  it("says so when the forecast fails", () => {
    render(
      <PlacePanel kind="fish" label="x" color={() => "#fff"} data="error" />,
    );
    expect(screen.getByText(/isn.t answering/)).toBeTruthy();
  });
  it("summarizes members' reports once there are enough", () => {
    const { rerender } = render(
      <ReportSummary kind="sunset" sum={{ days: 60, total: 2, by: [] }} />,
    );
    expect(screen.getByText(/2 so far/)).toBeTruthy();
    rerender(
      <ReportSummary
        kind="sunset"
        sum={{
          days: 60,
          total: 12,
          by: [
            { from: 0, n: 0, avg: null },
            { from: 60, n: 7, avg: 4.1 },
          ],
        }}
      />,
    );
    expect(screen.getByText(/scored 60\+: 4.1 stars/)).toBeTruthy();
  });
  it("opens the report form", () => {
    render(<ReportBox kind="sunset" />);
    fireEvent.click(screen.getByText("Rate tonight's sunset"));
    expect(screen.getAllByRole("button", { name: /star/ })).toHaveLength(5);
  });
});
