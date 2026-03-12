import { describe, expect, it } from "vitest";

import {
  getVersionPrereleaseTag,
  isForkPrereleaseVersion,
  resolveAppReleaseBranding,
} from "./appRelease";

describe("getVersionPrereleaseTag", () => {
  it("returns null for stable versions", () => {
    expect(getVersionPrereleaseTag("1.2.3")).toBeNull();
  });

  it("returns the prerelease tag for fork builds", () => {
    expect(getVersionPrereleaseTag("0.0.11-fork.3")).toBe("fork");
  });
});

describe("isForkPrereleaseVersion", () => {
  it("returns true for fork prerelease versions", () => {
    expect(isForkPrereleaseVersion("0.0.11-fork.3")).toBe(true);
  });

  it("returns false for non-fork prerelease versions", () => {
    expect(isForkPrereleaseVersion("0.0.11-alpha.1")).toBe(false);
  });
});

describe("resolveAppReleaseBranding", () => {
  it("keeps local dev-server sessions on Dev branding", () => {
    expect(resolveAppReleaseBranding({ version: "1.2.3", isDevelopment: true })).toEqual({
      stageLabel: "Dev",
      displayName: "T3 Code (Dev)",
      userDataDirName: "t3code-dev",
    });
  });

  it("brands fork prerelease packages as Dev", () => {
    expect(resolveAppReleaseBranding({ version: "0.0.11-fork.3", isDevelopment: false })).toEqual({
      stageLabel: "Dev",
      displayName: "T3 Code (Dev)",
      userDataDirName: "t3code-dev",
    });
  });

  it("keeps stable packaged builds on Alpha branding", () => {
    expect(resolveAppReleaseBranding({ version: "1.2.3", isDevelopment: false })).toEqual({
      stageLabel: "Alpha",
      displayName: "T3 Code (Alpha)",
      userDataDirName: "t3code",
    });
  });
});
