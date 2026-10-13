import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseNotice } from "@/components/PhaseNotice";

describe("PhaseNotice", () => {
  it("names the page and its phase", () => {
    render(<PhaseNotice page="Radar & Model Runs" phase="45" />);
    expect(
      screen.getByRole("heading", { name: "Radar & Model Runs" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/phase 45/)).toBeInTheDocument();
  });
});
