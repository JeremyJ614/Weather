/**
 * The official product split into blocks for display, with every line kept
 * exactly as the forecaster wrote it: the header, each ".SECTION..." block
 * (title line included), and the closing "$$" signature.
 */
export type RawBlock = {
  kind: "head" | "section" | "sign";
  title: string;
  lines: string[];
};

export function rawBlocks(text: string): RawBlock[] {
  const lines = text
    .replace(/\r/g, "")
    .replace(/^\n+|\n+$/g, "")
    .split("\n");
  const out: RawBlock[] = [{ kind: "head", title: "Header", lines: [] }];
  for (const line of lines) {
    const head = /^\.([A-Z][A-Z0-9 /&()-]+?)\.{2,}/.exec(line);
    if (head)
      out.push({ kind: "section", title: head[1].trim(), lines: [line] });
    else if (/^\$\$/.test(line))
      out.push({ kind: "sign", title: "Signature", lines: [line] });
    else out.at(-1)!.lines.push(line);
  }
  return out
    .map((b) => {
      const ls = [...b.lines];
      while (ls.length && !ls.at(-1)!.trim()) ls.pop();
      while (ls.length && !ls[0].trim()) ls.shift();
      return { ...b, lines: ls };
    })
    .filter((b) => b.lines.length);
}

/** "National Weather Service Wilmington OH" → "Wilmington OH". */
export function officeName(text: string): string | null {
  const m = /National Weather Service ([^\n]+)/.exec(text);
  return m ? m[1].trim() : null;
}
