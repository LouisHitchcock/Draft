import { defineConfig } from "tsdown";

// Keep the production server bundle self-contained so `node dist/index.mjs`
// still starts when Turbo replays cached build outputs before package-local
// workspace symlinks exist. Leave native/Node builtins external.
const INLINE_DEPENDENCY_PREFIXES = [
  "@agentclientprotocol/sdk",
  "@effect/",
  "@mariozechner/pi-coding-agent",
  "@pierre/diffs",
  "@draft/",
  "effect",
  "open",
  "ws",
  "zod",
];

function matchesDependencyPrefix(id: string, prefix: string): boolean {
  if (prefix.endsWith("/")) {
    return id.startsWith(prefix);
  }

  return id === prefix || id.startsWith(`${prefix}/`);
}

function shouldInlineDependency(id: string): boolean {
  if (id.startsWith("effect/")) {
    return true;
  }

  return INLINE_DEPENDENCY_PREFIXES.some((prefix) => matchesDependencyPrefix(id, prefix));
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  checks: {
    legacyCjs: false,
  },
  outDir: "dist",
  sourcemap: true,
  clean: true,
  noExternal: shouldInlineDependency,
  inlineOnly: false,
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
