import { describe, expect, it } from "vitest";

import { getLegacyUserDataDirNames, resolveDesktopUserDataPath } from "./userDataPath";

describe("getLegacyUserDataDirNames", () => {
  it("keeps the unified Draft profile compatible with legacy pre-Draft directories", () => {
    expect(getLegacyUserDataDirNames({ appDisplayName: "Draft" })).toEqual([
      "Draft",
      "T3 Code",
      "T3 Code (Alpha)",
      "T3 Code (Dev)",
    ]);
  });
});

describe("resolveDesktopUserDataPath", () => {
  it("prefers an existing legacy stable dir over the clean userData dir", () => {
    const existingPaths = new Set(["/config/Draft"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "draft",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Draft" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/Draft");
  });

  it("falls back to the clean userData dir when no legacy dir exists", () => {
    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "draft",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Draft" }),
        pathExists: () => false,
      }),
    ).toBe("/config/draft");
  });

  it("can recover the old alpha directory too", () => {
    const existingPaths = new Set(["/config/T3 Code (Alpha)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "draft",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Draft" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code (Alpha)");
  });

  it("can recover the old dev directory as a last resort", () => {
    const existingPaths = new Set(["/config/T3 Code (Dev)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "draft",
        legacyDirNames: getLegacyUserDataDirNames({ appDisplayName: "Draft" }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code (Dev)");
  });
});
