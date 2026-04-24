import { describe, expect, it } from "vitest";
import {
  getParagraphBreakCountsByLineId,
  parseInlineDocument,
} from "@/pages/home-v3-3/previewSpacing";

describe("Home v3.3 preview spacing", () => {
  it("preserves the exact number of blank lines between inline preview paragraphs", () => {
    const paragraphs = parseInlineDocument(`* First



* Second`, "    ");

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].blankLinesBefore).toBe(0);
    expect(paragraphs[1].blankLinesBefore).toBe(3);
  });

  it("ignores leading blank lines before the first paragraph", () => {
    const paragraphs = parseInlineDocument(`

* First`, "    ");

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].blankLinesBefore).toBe(0);
  });

  it("tracks exact blank-line counts for list preview paragraph spacing", () => {
    const counts = getParagraphBreakCountsByLineId(`* First


* Second

* Third`, [11, 22, 33]);

    expect(Array.from(counts.entries())).toEqual([
      [22, 2],
      [33, 1],
    ]);
  });
});
