/** gifenc ships no types: the calls the share cards use. */
declare module "gifenc" {
  export type Palette = number[][];
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: "rgb565" | "rgb444" | "rgba4444" },
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette;
        delay?: number;
        repeat?: number;
        /** Pixels of this index show the frame before (with dispose 1). */
        transparent?: boolean;
        transparentIndex?: number;
        /** 1: leave this frame in place under the next. */
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
