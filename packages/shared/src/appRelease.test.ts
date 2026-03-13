import { describe, expect, it } from "vitest";

import {
  getVersionPrereleaseTag,
  isForkPrereleaseVersion,
  isPrereleaseVersion,
  resolveAppReleaseBranding,
} from "./appRelease";

describe("getVersionPrereleaseTag", () => {
  it("returns null for stable versions", () => {
    expect(getVersionPrereleaseTag("1.2.3")).toBeNull();
  });

  it("returns the prerelease tag for tagged builds", () => {
    expect(getVersionPrereleaseTag("0.0.11-alpha.3")).toBe("alpha");
  });
});

describe("isPrereleaseVersion", () => {
  it("returns true for tagged prerelease versions", () => {
    expect(isPrereleaseVersion("0.0.11-alpha.3")).toBe(true);
  });

  it("returns false for stable versions", () => {
    expect(isPrereleaseVersion("1.2.3")).toBe(false);
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
      productName: "T3 Code (Dev)",
      appId: "com.t3tools.t3code.dev",
      stateDirName: "dev",
      userDataDirName: "t3code-dev",
    });
  });

  it("brands alpha prerelease packages as Dev", () => {
    expect(resolveAppReleaseBranding({ version: "0.0.11-alpha.3", isDevelopment: false })).toEqual({
      stageLabel: "Dev",
      displayName: "T3 Code (Dev)",
      productName: "T3 Code (Dev)",
      appId: "com.t3tools.t3code.dev",
      stateDirName: "dev",
      userDataDirName: "t3code-dev",
    });
  });

  it("keeps fork prerelease packages on Dev branding", () => {
    expect(resolveAppReleaseBranding({ version: "0.0.11-fork.3", isDevelopment: false })).toEqual({
      stageLabel: "Dev",
      displayName: "T3 Code (Dev)",
      productName: "T3 Code (Dev)",
      appId: "com.t3tools.t3code.dev",
      stateDirName: "dev",
      userDataDirName: "t3code-dev",
    });
  });

  it("keeps stable packaged builds on Alpha branding", () => {
    expect(resolveAppReleaseBranding({ version: "1.2.3", isDevelopment: false })).toEqual({
      stageLabel: "Alpha",
      displayName: "T3 Code (Alpha)",
      productName: "T3 Code",
      appId: "com.t3tools.t3code",
      stateDirName: "userdata",
      userDataDirName: "t3code",
    });
  });
});
