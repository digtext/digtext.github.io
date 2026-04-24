import { describe, expect, it } from "vitest";
import { normalizePastedListText } from "@/pages/home-v3-2/pasteNormalization";

describe("Home v3.2 paste normalization", () => {
  it("collapses blank spacer lines between pasted list items", () => {
    const pasted = `# Title

Meta line

* First bullet

  * Nested bullet

* Second bullet`;

    expect(normalizePastedListText(pasted)).toBe(`# Title

Meta line

* First bullet
\t* Nested bullet
* Second bullet`);
  });

  it("preserves blank lines that are not between list items", () => {
    const pasted = `Intro paragraph

* First bullet

Closing paragraph`;

    expect(normalizePastedListText(pasted)).toBe(`Intro paragraph

* First bullet

Closing paragraph`);
  });
});
