import { describe, expect, it } from "vitest";

import { getLegacyUserDataDirNames, resolveDesktopUserDataPath } from "./userDataPath";

describe("getLegacyUserDataDirNames", () => {
  it("keeps dev builds isolated from alpha profile dirs", () => {
    expect(
      getLegacyUserDataDirNames({
        appDisplayName: "T3 Code (Dev)",
        stageLabel: "Dev",
      }),
    ).toEqual(["T3 Code (Dev)"]);
  });

  it("lets alpha builds recover the historical stable product dir", () => {
    expect(
      getLegacyUserDataDirNames({
        appDisplayName: "T3 Code (Alpha)",
        stageLabel: "Alpha",
      }),
    ).toEqual(["T3 Code (Alpha)", "T3 Code"]);
  });
});

describe("resolveDesktopUserDataPath", () => {
  it("prefers an existing legacy dir over the clean userData dir", () => {
    const existingPaths = new Set(["/config/T3 Code (Alpha)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "t3code-dev",
        legacyDirNames: getLegacyUserDataDirNames({
          appDisplayName: "T3 Code (Dev)",
          stageLabel: "Dev",
        }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/t3code-dev");
  });

  it("falls back to the clean userData dir when no legacy dir exists", () => {
    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "t3code-dev",
        legacyDirNames: getLegacyUserDataDirNames({
          appDisplayName: "T3 Code (Dev)",
          stageLabel: "Dev",
        }),
        pathExists: () => false,
      }),
    ).toBe("/config/t3code-dev");
  });

  it("can recover the old plain productName directory too", () => {
    const existingPaths = new Set(["/config/T3 Code"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "t3code",
        legacyDirNames: getLegacyUserDataDirNames({
          appDisplayName: "T3 Code (Alpha)",
          stageLabel: "Alpha",
        }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/T3 Code");
  });

  it("keeps alpha builds isolated from dev-only profile dirs", () => {
    const existingPaths = new Set(["/config/T3 Code (Dev)"]);

    expect(
      resolveDesktopUserDataPath({
        appDataBase: "/config",
        userDataDirName: "t3code",
        legacyDirNames: getLegacyUserDataDirNames({
          appDisplayName: "T3 Code (Alpha)",
          stageLabel: "Alpha",
        }),
        pathExists: (path) => existingPaths.has(path),
      }),
    ).toBe("/config/t3code");
  });
});
