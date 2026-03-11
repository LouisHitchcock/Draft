import { describe, expect, it } from "vitest";

import { buildComposerMcpServerItems, formatMcpServerDescription } from "./mcpServers";

describe("formatMcpServerDescription", () => {
  it("formats enabled server details", () => {
    expect(
      formatMcpServerDescription({
        name: "context7",
        enabled: true,
        state: "enabled",
        authStatus: "o_auth",
        toolCount: 3,
        resourceCount: 0,
        resourceTemplateCount: 0,
      }),
    ).toBe("Enabled · OAuth · 3 tools");
  });

  it("formats disabled server details", () => {
    expect(
      formatMcpServerDescription({
        name: "paper",
        enabled: false,
        state: "disabled",
        authStatus: "unknown",
        toolCount: 0,
        resourceCount: 0,
        resourceTemplateCount: 0,
      }),
    ).toBe("Disabled in Codex config");
  });
});

describe("buildComposerMcpServerItems", () => {
  it("returns provider-specific items filtered by query", () => {
    const items = buildComposerMcpServerItems({
      provider: "codex",
      query: "oauth",
      providerMcpStatuses: [
        {
          provider: "codex",
          servers: [
            {
              name: "context7",
              enabled: true,
              state: "enabled",
              authStatus: "o_auth",
              toolCount: 3,
              resourceCount: 0,
              resourceTemplateCount: 0,
            },
            {
              name: "playwright",
              enabled: false,
              state: "disabled",
              authStatus: "unknown",
              toolCount: 0,
              resourceCount: 0,
              resourceTemplateCount: 0,
            },
          ],
        },
      ],
    });

    expect(items).toEqual([
      {
        id: "mcp:codex:context7",
        name: "context7",
        provider: "codex",
        state: "enabled",
        authStatus: "o_auth",
        description: "Enabled · OAuth · 3 tools",
      },
    ]);
  });
});
