import { describe, expect, it } from "vitest";
import { checkWord, WORDS } from "@/lib/weatherdle/words";

describe("Weatherdle words", () => {
  it("every listed word is playable and its hint doesn't give it away", () => {
    for (const w of WORDS) expect(checkWord(w.word, w.hint), w.word).toEqual(w);
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
  });

  it("cleans a suggested word and refuses bad ones", () => {
    expect(checkWord("Wall-Cloud", "A lowering under the base.")).toEqual({
      word: "WALLCLOUD",
      hint: "A lowering under the base.",
    });
    expect(checkWord("ab", "Too short a word.")).toBeNull();
    expect(checkWord("TORNADO", "A rotating column: a torn ado.")).toBeNull();
    expect(checkWord("HAIL", "")).toBeNull();
  });
});
