import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import sample from "../../samples/full-scope.clite?raw";
import errorSample from "../../samples/lexical-errors.clite?raw";
import { App } from "./App";

afterEach(() => vi.useRealTimers());

function tokenStream() {
  return within(screen.getByRole("region", { name: "Token stream" }));
}

function sourceTab(name: "Edit" | "Preview") {
  return within(screen.getByRole("tablist", { name: "Source view" })).getByRole(
    "tab",
    { name },
  );
}

function sampleDropdown() {
  return screen.getByRole("combobox", { name: "Load sample" });
}

function loadSample(name: "full-scope.clite" | "lexical-errors.clite") {
  fireEvent.change(sampleDropdown(), { target: { value: name } });

  expect(sampleDropdown()).toHaveValue("");
}

function edit(source: string) {
  if (sourceTab("Edit").getAttribute("aria-selected") !== "true") {
    fireEvent.click(sourceTab("Edit"));
  }

  fireEvent.change(screen.getByRole("textbox", { name: "Source code" }), {
    target: { value: source },
  });
}

function playToEnd() {
  const source =
    screen.getByLabelText<HTMLTextAreaElement>("Source code").value;

  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  act(() => vi.advanceTimersByTime((source.length * 3 + 2) * 200));
}

function speedButton() {
  return screen.getByRole("button", { name: /^Simulation speed: [124]x$/ });
}

function cycleSpeed(clicks = 1) {
  for (let click = 0; click < clicks; click += 1)
    fireEvent.click(speedButton());
}

describe("lexer interface", () => {
  it("loads the full-scope sample and exposes the initial recognition state", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Clite" }),
    ).toBeInTheDocument();
    expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");
    expect(sourceTab("Preview")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      sample,
    );
    expect(screen.getByRole("textbox", { name: "Source code" })).toBeVisible();
    expect(sampleDropdown()).toHaveValue("");
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
    expect(screen.getByText("0 transitions")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
        "None",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Inside the lexer" }),
      ).getByRole("status"),
    ).toHaveTextContent("—");
  });

  it("switches source tabs with arrow, Home, and End keys", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(sourceTab("Edit"));

    for (const [key, selected] of [
      ["{ArrowRight}", "Preview"],
      ["{ArrowRight}", "Edit"],
      ["{ArrowLeft}", "Preview"],
      ["{Home}", "Edit"],
      ["{End}", "Preview"],
    ] as const) {
      await user.keyboard(key);

      expect(sourceTab(selected)).toHaveFocus();
      expect(sourceTab(selected)).toHaveAttribute("aria-selected", "true");
      expect(
        sourceTab(selected === "Edit" ? "Preview" : "Edit"),
      ).toHaveAttribute("aria-selected", "false");
    }

    expect(screen.getByLabelText("Source trace")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "Source code" }),
    ).not.toBeInTheDocument();
  });

  it("preserves source and paused execution when switching tabs", () => {
    render(<App />);
    edit("int count;");
    fireEvent.click(screen.getByRole("button", { name: "Step →" }));
    fireEvent.click(sourceTab("Edit"));

    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      "int count;",
    );
    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Paused");

    fireEvent.click(sourceTab("Preview"));

    expect(screen.getByLabelText("Source trace")).toBeVisible();
    expect(screen.getByLabelText("Source trace")).toHaveTextContent(
      "int count;",
    );
    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Paused");
  });

  it("keeps playback running when switching tabs and stays in Edit when paused", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("int count;");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(sourceTab("Preview")).toHaveAttribute("aria-selected", "true");

    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(sourceTab("Edit"));
    act(() => vi.advanceTimersByTime(100));

    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Running");
    expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(600));

    expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      "int count;",
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(200));

    expect(sourceTab("Preview")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("2 transitions")).toBeInTheDocument();
  });

  it("steps through character consumption before emitting a token", async () => {
    const user = userEvent.setup();

    render(<App />);
    edit("a");

    await user.click(screen.getByRole("button", { name: "Step →" }));

    expect(sourceTab("Preview")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Source trace")).toBeVisible();
    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Inside the lexer" }),
      ).getByText('"a"'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Step →" }));

    expect(tokenStream().getByText("identifier")).toBeInTheDocument();
    expect(tokenStream().getByText("1 emitted")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Step →" }));

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Complete");
    expect(tokenStream().getByText("eof")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Step →" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("runs, pauses, resumes, and stops at EOF without duplicating tokens", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("int x;");

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(199));

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Running");
    expect(screen.getByText("0 transitions")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Running");
    expect(screen.getByText("1 transition")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Paused");

    playToEnd();

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Complete");
    expect(tokenStream().getByText("4 emitted")).toBeInTheDocument();
    expect(tokenStream().getAllByText("eof")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets execution while preserving the input", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("false");
    playToEnd();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(sourceTab("Edit"));

    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      "false",
    );
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
    expect(screen.getByText("0 transitions")).toBeInTheDocument();
  });

  it("clears output and stops playback when source changes", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("int a;");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(600));
    edit("bool b");
    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
    expect(screen.getByText("0 transitions")).toBeInTheDocument();
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
  });

  it("shows diagnostics and continues to valid tokens", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("@ int");
    playToEnd();

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Complete");
    expect(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
        "1 error",
      ),
    ).toBeInTheDocument();
    expect(tokenStream().getByText("int")).toBeInTheDocument();
    expect(tokenStream().getByText("eof")).toBeInTheDocument();
  });

  it("highlights a selected token in the source trace", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("int a;");
    playToEnd();
    fireEvent.click(sourceTab("Edit"));
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect token 1: int" }),
    );

    const trace = screen.getByLabelText("Source trace");

    expect(sourceTab("Preview")).toHaveAttribute("aria-selected", "true");
    expect(trace).toBeVisible();
    expect(trace.querySelector("mark")).toHaveTextContent("int");
  });

  it("opens Preview and highlights a selected diagnostic location", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("@ int");
    playToEnd();
    fireEvent.click(sourceTab("Edit"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByRole(
        "button",
        { name: "1:1" },
      ),
    );

    const trace = screen.getByLabelText("Source trace");

    expect(sourceTab("Preview")).toHaveAttribute("aria-selected", "true");
    expect(trace).toBeVisible();
    expect(trace.querySelector("mark")).toHaveTextContent("@");
  });

  it("handles empty source and restores the full-scope sample", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("");
    playToEnd();

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Complete");
    expect(tokenStream().getByText("1 emitted")).toBeInTheDocument();

    loadSample("full-scope.clite");

    expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      sample,
    );
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
  });

  it("discovers sorted source samples without token fixtures or upload controls", () => {
    const { container } = render(<App />);
    const options = within(sampleDropdown()).getAllByRole("option");

    expect(
      options.map((option) => [
        option.textContent,
        (option as HTMLOptionElement).value,
      ]),
    ).toEqual([
      ["Load sample", ""],
      ["full-scope.clite", "full-scope.clite"],
      ["lexical-errors.clite", "lexical-errors.clite"],
    ]);
    expect(options[0]).toBeDisabled();
    expect(sampleDropdown()).toHaveValue("");
    expect(
      screen.queryByRole("option", { name: /\.tokens\.json$/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(screen.queryByLabelText("Open source file")).not.toBeInTheDocument();
    expect(screen.queryByText("Open file")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load example" }),
    ).not.toBeInTheDocument();
  });

  it("switches between the bundled samples and resets the dropdown after each selection", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.selectOptions(sampleDropdown(), "lexical-errors.clite");

    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      errorSample,
    );
    expect(sampleDropdown()).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Step →" }));
    await user.selectOptions(sampleDropdown(), "full-scope.clite");

    expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      sample,
    );
    expect(sampleDropdown()).toHaveValue("");
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
    expect(screen.getByText("0 transitions")).toBeInTheDocument();
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
  });

  it.each(["editing", "stepping", "completion"])(
    "reloads the same sample after %s",
    (state) => {
      vi.useFakeTimers();
      render(<App />);
      loadSample("lexical-errors.clite");

      if (state === "editing") edit("changed");
      if (state === "stepping")
        fireEvent.click(screen.getByRole("button", { name: "Step →" }));
      if (state === "completion") {
        playToEnd();

        expect(screen.getByTestId("playback-status")).toHaveTextContent(
          "Complete",
        );
        expect(tokenStream().getByText("eof")).toBeInTheDocument();
      }

      loadSample("lexical-errors.clite");

      expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
        errorSample,
      );
      expect(sampleDropdown()).toHaveValue("");
      expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
      expect(screen.getByText("0 transitions")).toBeInTheDocument();
      expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Step →" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
    },
  );

  it("clears diagnostics, tokens, highlighting, and the timer when loading a sample during playback", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("@ int identifier;");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(1_400));

    expect(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
        "1 error",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Inspect token 1: int" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(
      screen.getByLabelText("Source trace").querySelector("mark"),
    ).toHaveTextContent("int");
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Running");
    expect(vi.getTimerCount()).toBe(1);

    loadSample("lexical-errors.clite");

    expect(sourceTab("Edit")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      errorSample,
    );
    expect(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
        "None",
      ),
    ).toBeInTheDocument();
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Inside the lexer" }),
      ).getByRole("status"),
    ).toHaveTextContent("—");
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(sourceTab("Preview"));
    act(() => vi.advanceTimersByTime(20_000));

    expect(
      screen.getByLabelText("Source trace").querySelector("mark"),
    ).toBeNull();
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
    expect(screen.getByText("0 transitions")).toBeInTheDocument();
    expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
  });

  it("reports the error sample diagnostics and still reaches EOF", () => {
    vi.useFakeTimers();
    render(<App />);
    loadSample("lexical-errors.clite");
    playToEnd();

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Complete");
    expect(tokenStream().getByText("eof")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
        "5 errors",
      ),
    ).toBeInTheDocument();
  });

  it("completes the full-scope example without lexical errors", () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(sample.length * 3 * 200));

    expect(screen.getByTestId("playback-status")).toHaveTextContent("Complete");
    expect(tokenStream().getByText("eof")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
        "None",
      ),
    ).toBeInTheDocument();
  });
});

describe("simulation speed", () => {
  const speeds = [
    { speed: 1, interval: 200, clicks: 0 },
    { speed: 2, interval: 100, clicks: 1 },
    { speed: 4, interval: 50, clicks: 2 },
  ];

  it("cycles accessible labels and visible values between Run/Pause and Reset", () => {
    vi.useFakeTimers();
    render(<App />);

    for (const [index, speed] of [1, 2, 4, 1].entries()) {
      if (index > 0) cycleSpeed();

      const button = screen.getByRole("button", {
        name: `Simulation speed: ${speed}x`,
      });

      expect(button).toHaveTextContent(new RegExp(`^${speed}x$`));
      expect(button).toHaveAttribute("title", "simulation speed");
      expect(button).not.toHaveAttribute("aria-pressed");
      expect(button.previousElementSibling).toBe(
        screen.getByRole("button", { name: "Run" }),
      );
      expect(button.nextElementSibling).toBe(
        screen.getByRole("button", { name: "Reset" }),
      );
    }

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(speedButton().previousElementSibling).toBe(
      screen.getByRole("button", { name: "Pause" }),
    );
    expect(speedButton().nextElementSibling).toBe(
      screen.getByRole("button", { name: "Reset" }),
    );
  });

  it.each(speeds)(
    "advances exactly one transition every $interval ms at speed $speed",
    ({ interval, clicks }) => {
      vi.useFakeTimers();
      render(<App />);
      edit("int count;");
      cycleSpeed(clicks);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      act(() => vi.advanceTimersByTime(interval - 1));

      expect(screen.getByText("0 transitions")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.getByText("1 transition")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(interval - 1));

      expect(screen.getByText("1 transition")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.getByText("2 transitions")).toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(1);
    },
  );

  it.each([
    { speed: 1, interval: 200, clicks: 0, nextInterval: 100 },
    { speed: 2, interval: 100, clicks: 1, nextInterval: 50 },
    { speed: 4, interval: 50, clicks: 2, nextInterval: 200 },
  ])(
    "restarts one fresh interval without resetting a running lexer at speed $speed",
    ({ interval, clicks, nextInterval }) => {
      vi.useFakeTimers();
      render(<App />);
      edit("@ int identifier;");
      cycleSpeed(clicks);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      act(() => vi.advanceTimersByTime(interval * 7));

      const lexerState = screen.getByRole("region", {
        name: "Inside the lexer",
      }).textContent;
      const tokens = screen.getByRole("region", {
        name: "Token stream",
      }).textContent;
      const diagnostics = screen.getByRole("region", {
        name: "Diagnostics",
      }).textContent;
      const trace = screen.getByLabelText("Source trace").innerHTML;

      expect(screen.getByText("7 transitions")).toBeInTheDocument();
      expect(tokenStream().getByText("int")).toBeInTheDocument();
      expect(
        within(screen.getByRole("region", { name: "Diagnostics" })).getByText(
          "1 error",
        ),
      ).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(Math.min(interval, nextInterval) - 1));
      cycleSpeed();

      expect(screen.getByLabelText("Source code")).toHaveValue(
        "@ int identifier;",
      );
      expect(
        screen.getByRole("region", { name: "Inside the lexer" }).textContent,
      ).toBe(lexerState);
      expect(
        screen.getByRole("region", { name: "Token stream" }).textContent,
      ).toBe(tokens);
      expect(
        screen.getByRole("region", { name: "Diagnostics" }).textContent,
      ).toBe(diagnostics);
      expect(screen.getByLabelText("Source trace").innerHTML).toBe(trace);
      expect(screen.getByTestId("playback-status")).toHaveTextContent(
        "Running",
      );
      expect(vi.getTimerCount()).toBe(1);

      act(() => vi.advanceTimersByTime(nextInterval - 1));

      expect(screen.getByText("7 transitions")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.getByText("8 transitions")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(nextInterval));

      expect(screen.getByText("9 transitions")).toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(1);
    },
  );

  it("changes speed while paused without resuming and retains it on resume", () => {
    vi.useFakeTimers();
    render(<App />);
    edit("int count;");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    cycleSpeed();
    act(() => vi.advanceTimersByTime(1_000));

    expect(
      screen.getByRole("button", { name: "Simulation speed: 2x" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("playback-status")).toHaveTextContent("Paused");
    expect(screen.getByText("1 transition")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(99));

    expect(screen.getByText("1 transition")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByText("2 transitions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Simulation speed: 2x" }),
    ).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
  });

  it.each(["Ready", "Complete"])(
    "does not start a timer when changing speed while %s",
    (status) => {
      vi.useFakeTimers();
      render(<App />);
      edit("");

      if (status === "Complete")
        fireEvent.click(screen.getByRole("button", { name: "Step →" }));

      const tokens = screen.getByRole("region", {
        name: "Token stream",
      }).textContent;

      for (const speed of [2, 4, 1]) {
        cycleSpeed();
        act(() => vi.advanceTimersByTime(1_000));

        expect(
          screen.getByRole("button", { name: `Simulation speed: ${speed}x` }),
        ).toBeEnabled();
        expect(screen.getByTestId("playback-status")).toHaveTextContent(status);
        expect(
          screen.getByText(
            status === "Complete" ? "1 transition" : "0 transitions",
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("region", { name: "Token stream" }).textContent,
        ).toBe(tokens);
        expect(vi.getTimerCount()).toBe(0);
      }
    },
  );

  it.each(speeds)(
    "steps exactly once per click at speed $speed without starting playback",
    ({ clicks }) => {
      vi.useFakeTimers();
      render(<App />);
      edit("ab");
      cycleSpeed(clicks);

      for (const transitions of [1, 2, 3, 4]) {
        fireEvent.click(screen.getByRole("button", { name: "Step →" }));
        act(() => vi.advanceTimersByTime(1_000));

        expect(
          screen.getByText(
            `${transitions} ${transitions === 1 ? "transition" : "transitions"}`,
          ),
        ).toBeInTheDocument();
        expect(screen.getByTestId("playback-status")).toHaveTextContent(
          transitions === 4 ? "Complete" : "Paused",
        );
        expect(vi.getTimerCount()).toBe(0);
      }

      expect(tokenStream().getByText("2 emitted")).toBeInTheDocument();
      expect(tokenStream().getAllByText("eof")).toHaveLength(1);
    },
  );

  it.each(["Reset", "editing", "sample load"])(
    "preserves speed through %s without restarting playback",
    (action) => {
      vi.useFakeTimers();
      render(<App />);
      edit("int count;");
      cycleSpeed(2);
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      act(() => vi.advanceTimersByTime(100));

      expect(screen.getByText("2 transitions")).toBeInTheDocument();

      if (action === "Reset")
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      if (action === "editing") edit("bool changed;");
      if (action === "sample load") loadSample("lexical-errors.clite");

      act(() => vi.advanceTimersByTime(1_000));

      expect(
        screen.getByRole("button", { name: "Simulation speed: 4x" }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("playback-status")).toHaveTextContent("Ready");
      expect(screen.getByText("0 transitions")).toBeInTheDocument();
      expect(tokenStream().getByText("0 emitted")).toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(0);

      fireEvent.click(screen.getByRole("button", { name: "Run" }));
      act(() => vi.advanceTimersByTime(49));

      expect(screen.getByText("0 transitions")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.getByText("1 transition")).toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(1);
    },
  );
});
