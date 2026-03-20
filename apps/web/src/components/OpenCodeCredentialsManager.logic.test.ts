import { describe, expect, it } from "vitest";

import { formatShellCommandBinary, shellQuote } from "./OpenCodeCredentialsManager.logic";

describe("formatShellCommandBinary", () => {
  it("leaves the default OpenCode binary unquoted", () => {
    expect(formatShellCommandBinary(undefined)).toBe("opencode");
  });

  it("quotes custom binary paths before composing shell commands", () => {
    expect(formatShellCommandBinary("/tmp/Open Code/bin/opencode")).toBe(
      "'/tmp/Open Code/bin/opencode'",
    );
  });
});

describe("shellQuote", () => {
  it("escapes embedded single quotes", () => {
    expect(shellQuote("open'code")).toBe("'open'\\''code'");
  });
});
