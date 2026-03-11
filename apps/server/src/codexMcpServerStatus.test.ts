import { describe, expect, it } from "vitest";

import {
  mergeCodexMcpServerStatuses,
  normalizeCodexMcpAuthStatus,
  parseCodexMcpServerEnabledStates,
} from "./codexMcpServerStatus";

describe("normalizeCodexMcpAuthStatus", () => {
  it("maps Codex app-server auth statuses into contract values", () => {
    expect(normalizeCodexMcpAuthStatus("unsupported")).toBe("unsupported");
    expect(normalizeCodexMcpAuthStatus("notLoggedIn")).toBe("not_logged_in");
    expect(normalizeCodexMcpAuthStatus("bearerToken")).toBe("bearer_token");
    expect(normalizeCodexMcpAuthStatus("oAuth")).toBe("o_auth");
    expect(normalizeCodexMcpAuthStatus("unexpected")).toBe("unknown");
  });
});

describe("parseCodexMcpServerEnabledStates", () => {
  it("reads enabled flags from top-level mcp server sections", () => {
    const states = parseCodexMcpServerEnabledStates(`
[mcp_servers.paper]
enabled = true
url = "http://127.0.0.1:29979/mcp"

[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]

[mcp_servers.context7]
enabled = false
url = "https://mcp.context7.com/mcp"

[mcp_servers.context7.http_headers]
CONTEXT7_API_KEY = "secret"
`);

    expect([...states.entries()]).toEqual([
      ["paper", true],
      ["playwright", true],
      ["context7", false],
    ]);
  });

  it("supports quoted mcp server names", () => {
    const states = parseCodexMcpServerEnabledStates(`
[mcp_servers."paper.design"]
enabled = false
`);

    expect([...states.entries()]).toEqual([["paper.design", false]]);
  });
});

describe("mergeCodexMcpServerStatuses", () => {
  it("merges config-enabled flags with runtime counts and auth statuses", () => {
    const merged = mergeCodexMcpServerStatuses(
      new Map([
        ["paper", true],
        ["playwright", false],
      ]),
      [
        {
          name: "paper",
          authStatus: "o_auth",
          toolCount: 3,
          resourceCount: 2,
          resourceTemplateCount: 1,
        },
      ],
    );

    expect(merged).toEqual([
      {
        name: "paper",
        enabled: true,
        state: "enabled",
        authStatus: "o_auth",
        toolCount: 3,
        resourceCount: 2,
        resourceTemplateCount: 1,
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
    ]);
  });
});
