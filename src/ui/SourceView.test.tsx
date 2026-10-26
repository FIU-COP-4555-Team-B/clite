import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourceView } from "./SourceView";

describe("source trace scrolling", () => {
  it("keeps the active span inside its own viewport", () => {
    let markerBounds = new DOMRect(180, 150, 20, 10);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.tagName === "PRE"
          ? new DOMRect(20, 10, 100, 100)
          : markerBounds;
      },
    );

    const { rerender } = render(
      <SourceView
        source="ab"
        position={{ offset: 1, line: 1, column: 2 }}
        span={{
          start: { offset: 0, line: 1, column: 1 },
          end: { offset: 1, line: 1, column: 2 },
        }}
      />,
    );
    const viewport = screen.getByLabelText("Source trace");

    expect(viewport.scrollTop).toBe(70);
    expect(viewport.scrollLeft).toBe(100);

    markerBounds = new DOMRect(0, 0, 10, 10);
    rerender(
      <SourceView
        source="ab"
        position={{ offset: 0, line: 1, column: 1 }}
        span={null}
      />,
    );

    expect(viewport.scrollTop).toBe(40);
    expect(viewport.scrollLeft).toBe(60);
  });
});
