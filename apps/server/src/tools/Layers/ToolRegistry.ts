import fs from "node:fs/promises";
import path from "node:path";

import {
  TerminalExecInput,
  type ToolInvocation,
  type ToolName,
} from "@draft/contracts";
import { Effect, Layer, Schema } from "effect";
import {
  TerminalCommandRunner,
  type TerminalCommandRunnerShape,
} from "../../terminal/Services/CommandRunner.ts";
import {
  ToolExecutionError,
  ToolHarnessValidationError,
  ToolNotFoundError,
} from "../Errors.ts";
import { ToolRegistry, type ToolExecutionContext, type ToolRegistryShape } from "../Services/ToolRegistry.ts";

const decodeTerminalExecInput = Schema.decodeUnknownSync(TerminalExecInput);

type ToolAdapter = (
  context: ToolExecutionContext,
  invocation: ToolInvocation,
) => Effect.Effect<unknown, ToolExecutionError | ToolHarnessValidationError>;

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const source = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${source}$`, "i");
}

async function walkFilesRecursively(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const nextPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFilesRecursively(nextPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(nextPath);
    }
  }
  return files;
}

const terminalExecAdapter =
  (terminalCommandRunner: TerminalCommandRunnerShape) =>
  (_context: ToolExecutionContext, invocation: ToolInvocation) =>
    Effect.try({
      try: () => decodeTerminalExecInput(invocation.input),
      catch: (cause) =>
        new ToolHarnessValidationError({
          operation: "ToolRegistry.terminal.exec",
          issue: "Invalid terminal.exec input payload",
          cause,
        }),
    }).pipe(
      Effect.flatMap((parsed) =>
        terminalCommandRunner.exec(parsed).pipe(
          Effect.mapError(
            (cause) =>
              new ToolExecutionError({
                toolName: invocation.toolName,
                detail: cause.message,
                cause,
              }),
          ),
        ),
      ),
    );

const grepAdapter: ToolAdapter = (context, invocation) =>
  Effect.tryPromise({
    try: async () => {
      const input = invocation.input as {
        cwd?: string;
        query?: string;
        maxMatches?: number;
        includeFiles?: string[];
      };
      const cwd = typeof input?.cwd === "string" ? input.cwd : process.cwd();
      const query = typeof input?.query === "string" ? input.query : "";
      if (query.trim().length === 0) {
        throw new Error("query is required");
      }
      const includeFiles = Array.isArray(input?.includeFiles)
        ? input.includeFiles.filter((value): value is string => typeof value === "string")
        : null;
      const maxMatches =
        typeof input?.maxMatches === "number" && Number.isInteger(input.maxMatches)
          ? Math.max(1, Math.min(1000, input.maxMatches))
          : 200;
      const regex = new RegExp(query, "i");
      const files = await walkFilesRecursively(cwd);
      const filteredFiles =
        includeFiles && includeFiles.length > 0
          ? files.filter((filePath) =>
              includeFiles.some((include) => filePath.toLowerCase().includes(include.toLowerCase())),
            )
          : files;
      const matches: Array<{ file: string; line: number; text: string }> = [];
      for (const filePath of filteredFiles) {
        if (matches.length >= maxMatches) break;
        let text: string;
        try {
          text = await fs.readFile(filePath, "utf8");
        } catch {
          continue;
        }
        const lines = text.split(/\r?\n/g);
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          if (line !== undefined && regex.test(line)) {
            matches.push({ file: filePath, line: index + 1, text: line });
            if (matches.length >= maxMatches) break;
          }
        }
      }
      return {
        threadId: context.threadId,
        query,
        cwd,
        matches,
        truncated: matches.length >= maxMatches,
      };
    },
    catch: (cause) =>
      new ToolExecutionError({
        toolName: invocation.toolName,
        detail: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  });

const fileGlobAdapter: ToolAdapter = (context, invocation) =>
  Effect.tryPromise({
    try: async () => {
      const input = invocation.input as {
        searchDir?: string;
        patterns?: string[];
        maxMatches?: number;
      };
      const searchDir = typeof input?.searchDir === "string" ? input.searchDir : process.cwd();
      const patterns =
        Array.isArray(input?.patterns) && input.patterns.length > 0
          ? input.patterns.filter((value): value is string => typeof value === "string")
          : ["*"];
      const regexes = patterns.map(wildcardToRegExp);
      const maxMatches =
        typeof input?.maxMatches === "number" && Number.isInteger(input.maxMatches)
          ? Math.max(1, Math.min(2000, input.maxMatches))
          : 500;
      const files = await walkFilesRecursively(searchDir);
      const matched = files
        .filter((filePath) => regexes.some((regex) => regex.test(path.basename(filePath))))
        .slice(0, maxMatches);
      return {
        threadId: context.threadId,
        searchDir,
        patterns,
        matchedFiles: matched,
        truncated: matched.length >= maxMatches,
      };
    },
    catch: (cause) =>
      new ToolExecutionError({
        toolName: invocation.toolName,
        detail: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  });

const readFilesAdapter: ToolAdapter = (_context, invocation) =>
  Effect.tryPromise({
    try: async () => {
      const input = invocation.input as { files?: Array<{ path?: string; ranges?: string[] }> };
      const files = Array.isArray(input?.files) ? input.files : [];
      const results: Array<{ path: string; content?: string; error?: string }> = [];
      for (const item of files) {
        const filePath = typeof item?.path === "string" ? item.path : "";
        if (!filePath) continue;
        try {
          const content = await fs.readFile(filePath, "utf8");
          results.push({ path: filePath, content });
        } catch (error) {
          results.push({
            path: filePath,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return { files: results };
    },
    catch: (cause) =>
      new ToolExecutionError({
        toolName: invocation.toolName,
        detail: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  });

const applyPatchAdapter: ToolAdapter = (_context, invocation) =>
  Effect.succeed({
    status: "not_implemented",
    detail:
      "apply_patch adapter requires grammar-aware patch processing and is reserved for phase 4 hardening.",
    toolName: invocation.toolName,
  });

const semanticSearchAdapter: ToolAdapter = (_context, invocation) =>
  Effect.succeed({
    status: "not_implemented",
    detail: "semantic_search adapter requires project index integration.",
    toolName: invocation.toolName,
  });

const passthroughStubAdapter: ToolAdapter = (_context, invocation) =>
  Effect.succeed({
    status: "not_implemented",
    detail: `Adapter for '${invocation.toolName}' is scaffolded and awaits external integration wiring.`,
    toolName: invocation.toolName,
  });

const makeAdapters = (terminalCommandRunner: TerminalCommandRunnerShape): Map<ToolName, ToolAdapter> => {
  const adapters = new Map<ToolName, ToolAdapter>();
  adapters.set("terminal.exec", terminalExecAdapter(terminalCommandRunner));
  adapters.set("grep", grepAdapter);
  adapters.set("file_glob", fileGlobAdapter);
  adapters.set("read_files", readFilesAdapter);
  adapters.set("apply_patch", applyPatchAdapter);
  adapters.set("semantic_search", semanticSearchAdapter);
  adapters.set("read_skill", passthroughStubAdapter);
  adapters.set("search_warp_documentation", passthroughStubAdapter);
  adapters.set("web_search", passthroughStubAdapter);
  adapters.set("fetch_web_pages", passthroughStubAdapter);
  adapters.set("create_plan", passthroughStubAdapter);
  adapters.set("read_plans", passthroughStubAdapter);
  adapters.set("edit_plans", passthroughStubAdapter);
  adapters.set("create_todo_list", passthroughStubAdapter);
  adapters.set("add_todos", passthroughStubAdapter);
  adapters.set("read_todos", passthroughStubAdapter);
  adapters.set("mark_todo_as_done", passthroughStubAdapter);
  adapters.set("remove_todos", passthroughStubAdapter);
  adapters.set("insert_code_review_comments", passthroughStubAdapter);
  adapters.set("address_review_comments", passthroughStubAdapter);
  adapters.set("report_pr", passthroughStubAdapter);
  return adapters;
};

const makeToolRegistry = Effect.gen(function* () {
  const terminalCommandRunner = yield* TerminalCommandRunner;
  const adapters = makeAdapters(terminalCommandRunner);

  const execute: ToolRegistryShape["execute"] = (context, invocation) =>
    Effect.gen(function* () {
      const adapter = adapters.get(invocation.toolName);
      if (!adapter) {
        return yield* new ToolNotFoundError({
          toolName: invocation.toolName,
        });
      }
      return yield* adapter(context, invocation);
    });

  return {
    execute,
  } satisfies ToolRegistryShape;
});

export const ToolRegistryLive = Layer.effect(ToolRegistry, makeToolRegistry);
