import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SiteHeader from "@/components/SiteHeader";

describe("SiteHeader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("scrolls back to the top when Home is clicked on the home page", () => {
    window.history.replaceState(null, "", "/#prompt");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/#prompt"]}>
        <SiteHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Home" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
  });
});
