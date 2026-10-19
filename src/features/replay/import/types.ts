/** A single GPS fix: epoch seconds, latitude, longitude. */
export type Fix = [number, number, number];

export interface ParsedTrack {
  fixes: Fix[];
  /** What the file called this, where it said. */
  name?: string;
  /** Which parser handled it, for the error message when something looks wrong. */
  format: string;
  /** Anything the parser wants the user to know — dropped points, guessed columns. */
  notes: string[];
}

export interface ColumnMap {
  time: string;
  lat: string;
  lon: string;
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
