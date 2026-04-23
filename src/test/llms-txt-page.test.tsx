import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import LlmsTxtPage from "@/pages/LlmsTxtPage";

const llmsMarkdown = `# Dig Text

## How to write good dig text

1. Write the shortest possible summary first.
2. Write a slightly longer version.

\`\`\`
- Parent
\t- Child
\`\`\`
`;

describe("LlmsTxtPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders ordered lists compactly and untyped fenced code as one block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(llmsMarkdown),
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/llms"]}>
        <LlmsTxtPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Write the shortest possible summary first."),
    ).toBeInTheDocument();

    const orderedList = document.querySelector("ol");
    expect(orderedList).toHaveClass("list-decimal");
    expect(orderedList?.querySelectorAll("li")).toHaveLength(2);
    expect(orderedList?.querySelector("li")?.className).toContain("[&>p]:mb-0");

    const codeBlock = document.querySelector("pre code");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveClass("block");
    expect(codeBlock).toHaveTextContent("- Parent");
    expect(codeBlock).toHaveTextContent("- Child");
  });
});
