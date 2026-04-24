import { describe, expect, it } from "vitest";
import { shouldShowExpandAllLabel } from "@/pages/HomeV3_3_PolishedFullscreen";

describe("Home v3.3 expand-all label visibility", () => {
  it("keeps the label when the toolbar can absorb the wider button", () => {
    expect(
      shouldShowExpandAllLabel({
        toolbarClientWidth: 611,
        occupiedToolbarWidth: 520,
        currentButtonWidth: 34,
        expandedButtonWidth: 108,
      }),
    ).toBe(true);
  });

  it("collapses back to icon-only when the wider button would overflow", () => {
    expect(
      shouldShowExpandAllLabel({
        toolbarClientWidth: 560,
        occupiedToolbarWidth: 520,
        currentButtonWidth: 34,
        expandedButtonWidth: 108,
      }),
    ).toBe(false);
  });

  it("returns false until all measurements are available", () => {
    expect(
      shouldShowExpandAllLabel({
        toolbarClientWidth: 0,
        occupiedToolbarWidth: 520,
        currentButtonWidth: 34,
        expandedButtonWidth: 108,
      }),
    ).toBe(false);
  });
});
