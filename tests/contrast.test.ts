import { describe, expect, it } from "vitest";
import { contrast, luminance, onAccent } from "@/lib/theme/contrast";

describe("contrast", () => {
  it("measures the extremes", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
  });

  it("is symmetric", () => {
    expect(contrast("#d9b76f", "#0b0c14")).toBeCloseTo(
      contrast("#0b0c14", "#d9b76f"),
    );
  });

  it("puts dark ink on the light VIP gold and white on deep blue", () => {
    expect(onAccent("#d9b76f")).toBe("#0b0a12");
    expect(onAccent("#3d3dbf")).toBe("#ffffff");
  });

  it("rejects malformed colors", () => {
    expect(() => luminance("gold")).toThrow();
  });
});
