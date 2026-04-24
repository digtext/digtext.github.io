import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  InlineParagraphPreview,
  type InlineParagraphPreviewHandle,
} from "@/pages/HomeV3_3_PolishedFullscreen";

describe("Home v3.3 inline preview", () => {
  it("parses inline ((...)) dig markers inside a single line", () => {
    const ref = createRef<InlineParagraphPreviewHandle>();

    render(
      <InlineParagraphPreview
        ref={ref}
        text="- Intro with ((hidden [link](https://example.com)))"
      />,
    );

    expect(screen.queryByText("hidden")).not.toBeInTheDocument();

    act(() => {
      ref.current?.expandAll();
    });

    expect(ref.current?.anyExpanded).toBe(true);
    expect(screen.getByText("hidden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute(
      "href",
      "https://example.com",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse section from start" }),
    );

    expect(ref.current?.anyExpanded).toBe(false);
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });
});
