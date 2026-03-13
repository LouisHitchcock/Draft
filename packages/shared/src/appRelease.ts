const VERSION_PRERELEASE_PATTERN = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)$/;
const DEFAULT_DESKTOP_PRODUCT_NAME = "T3 Code";
const DEFAULT_DESKTOP_APP_ID = "com.t3tools.t3code";

export interface AppReleaseBrandingInput {
  readonly version: string;
  readonly isDevelopment: boolean;
}

export interface AppReleaseBranding {
  readonly stageLabel: "Dev" | "Alpha";
  readonly displayName: string;
  readonly productName: string;
  readonly appId: string;
  readonly stateDirName: string;
  readonly userDataDirName: string;
}

export function getVersionPrereleaseTag(version: string): string | null {
  const match = VERSION_PRERELEASE_PATTERN.exec(version);
  if (!match) {
    return null;
  }

  const prereleaseTag = match[1]?.split(".")[0] ?? "";
  if (prereleaseTag.length === 0 || !/[A-Za-z]/.test(prereleaseTag)) {
    return null;
  }

  return prereleaseTag;
}

export function isForkPrereleaseVersion(version: string): boolean {
  return getVersionPrereleaseTag(version) === "fork";
}

export function isPrereleaseVersion(version: string): boolean {
  return getVersionPrereleaseTag(version) !== null;
}

export function resolveAppReleaseBranding(input: AppReleaseBrandingInput): AppReleaseBranding {
  const stageLabel = input.isDevelopment || isPrereleaseVersion(input.version) ? "Dev" : "Alpha";

  return {
    stageLabel,
    displayName: `T3 Code (${stageLabel})`,
    productName: stageLabel === "Dev" ? `T3 Code (${stageLabel})` : DEFAULT_DESKTOP_PRODUCT_NAME,
    appId: stageLabel === "Dev" ? `${DEFAULT_DESKTOP_APP_ID}.dev` : DEFAULT_DESKTOP_APP_ID,
    stateDirName: stageLabel === "Dev" ? "dev" : "userdata",
    userDataDirName: stageLabel === "Dev" ? "t3code-dev" : "t3code",
  };
}
