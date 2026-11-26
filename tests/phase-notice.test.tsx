import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhaseNotice } from "@/components/PhaseNotice";

// PageHero is an async server component (it reads the owner's saved page names), which a
// browser-style test renderer can't run; a plain stand-in keeps this test on PhaseNotice.
vi.mock("@/components/ui/PageHero", () => ({
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe("PhaseNotice", () => {
  it("names the page and its phase", () => {
    render(<PhaseNotice page="Radar & Model Runs" phase="45" />);
    expect(
      screen.getByRole("heading", { name: "Radar & Model Runs" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/phase 45/)).toBeInTheDocument();
  });
});
