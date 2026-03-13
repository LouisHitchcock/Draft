import Path from "node:path";

const STABLE_DESKTOP_PRODUCT_NAME = "T3 Code";

export function getLegacyUserDataDirNames(args: {
  appDisplayName: string;
  stageLabel: "Dev" | "Alpha";
}): string[] {
  const legacyDirNames =
    args.stageLabel === "Dev"
      ? [args.appDisplayName]
      : [args.appDisplayName, STABLE_DESKTOP_PRODUCT_NAME];

  return Array.from(new Set(legacyDirNames));
}

export function resolveDesktopUserDataPath(args: {
  appDataBase: string;
  userDataDirName: string;
  legacyDirNames: readonly string[];
  pathExists: (path: string) => boolean;
}): string {
  for (const legacyDirName of args.legacyDirNames) {
    const legacyPath = Path.join(args.appDataBase, legacyDirName);
    if (args.pathExists(legacyPath)) {
      return legacyPath;
    }
  }

  return Path.join(args.appDataBase, args.userDataDirName);
}
