import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EditableLineView,
  type EditableLine,
  type EditableLineViewHandle,
} from "@/components/EditableLineView";

describe("EditableLineView read-only preview", () => {
  it("renders markdown and inline ((...)) dig markers in the live Home preview mode", () => {
    const lines: EditableLine[] = [
      {
        id: 1,
        indent: 0,
        text: "**Bold** intro with ((hidden [link](https://example.com)))",
      },
    ];

    render(
      <EditableLineView
        lines={lines}
        onLinesChange={() => {}}
        readOnly
        readOnlyInlineDigSyntax="parentheses"
      />,
    );

    expect(screen.getByText("Bold")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("hidden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("expands and collapses both line-based and inline dig content through the shared handle", () => {
    const ref = createRef<EditableLineViewHandle>();
    const lines: EditableLine[] = [
      { id: 1, indent: 0, text: "Parent ((inline detail))" },
      { id: 2, indent: 1, text: "Nested child" },
    ];

    render(
      <EditableLineView
        ref={ref}
        lines={lines}
        onLinesChange={() => {}}
        readOnly
        readOnlyInlineDigSyntax="parentheses"
      />,
    );

    expect(ref.current?.hasExpandables).toBe(true);
    expect(screen.queryByText("inline detail")).not.toBeInTheDocument();
    expect(screen.getByText("Nested child")).toBeInTheDocument();

    act(() => {
      ref.current?.collapseAll();
    });

    expect(ref.current?.anyExpanded).toBe(false);
    expect(screen.queryByText("Nested child")).not.toBeInTheDocument();

    act(() => {
      ref.current?.expandAll();
    });

    expect(ref.current?.anyExpanded).toBe(true);
    expect(screen.getByText("inline detail")).toBeInTheDocument();
    expect(screen.getByText("Nested child")).toBeInTheDocument();

    act(() => {
      ref.current?.collapseAll();
    });

    expect(ref.current?.anyExpanded).toBe(false);
    expect(screen.queryByText("inline detail")).not.toBeInTheDocument();
    expect(screen.queryByText("Nested child")).not.toBeInTheDocument();
  });
});
