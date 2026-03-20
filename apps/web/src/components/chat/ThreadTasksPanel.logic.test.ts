import { describe, expect, it } from "vitest";

import { formatTaskActivitySummary } from "./ThreadTasksPanel.logic";

describe("formatTaskActivitySummary", () => {
  it("lists each present task state instead of treating all non-running tasks as completed", () => {
    expect(
      formatTaskActivitySummary([
        { status: "running" },
        { status: "completed" },
        { status: "failed" },
        { status: "stopped" },
      ]),
    ).toBe("1 running · 1 completed · 1 failed · 1 stopped");
  });

  it("omits zero-count states from the summary", () => {
    expect(formatTaskActivitySummary([{ status: "failed" }, { status: "stopped" }])).toBe(
      "1 failed · 1 stopped",
    );
  });
});
