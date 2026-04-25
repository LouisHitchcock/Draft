import { spawn } from "node:child_process";
import readline from "node:readline";
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { ServerMcpServerAuthStatus, ServerMcpServerStatus } from "@draft/contracts";
import { buildCodexInitializeParams } from "./codexAppServerManager";

const DEFAULT_CODEX_BINARY = "codex";
const DEFAULT_RPC_TIMEOUT_MS = 5_000;
const DEFAULT_PAGE_LIMIT = 100;

interface CodexJsonRpcError {
  message?: string;
}

interface CodexJsonRpcResponse {
  id?: string | number;
  result?: unknown;
  error?: CodexJsonRpcError;
}

interface CodexRuntimeMcpServerStatus {
  readonly name: string;
  readonly authStatus: ServerMcpServerAuthStatus;
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly resourceTemplateCount: number;
}

interface CodexListMcpStatusResponse {
  readonly data: ReadonlyArray<{
    readonly name?: unknown;
    readonly authStatus?: unknown;
    readonly tools?: unknown;
    readonly resources?: unknown;
    readonly resourceTemplates?: unknown;
  }>;
  readonly nextCursor?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseServerSection(sectionName: string): { name: string; isRoot: boolean } | null {
  if (!sectionName.startsWith("mcp_servers.")) {
    return null;
  }

  const remainder = sectionName.slice("mcp_servers.".length);
  if (remainder.length === 0) {
    return null;
  }

  const quote = remainder[0];
  if (quote === '"' || quote === "'") {
    const closingIndex = remainder.indexOf(quote, 1);
    if (closingIndex <= 1) {
      return null;
    }
    const name = remainder.slice(1, closingIndex);
    const suffix = remainder.slice(closingIndex + 1);
    return {
      name,
      isRoot: suffix.length === 0,
    };
  }

  const bareMatch = /^([^.\s]+)(?:\.(.+))?$/.exec(remainder);
  if (!bareMatch || !bareMatch[1]) {
    return null;
  }
  return {
    name: bareMatch[1],
    isRoot: bareMatch[2] === undefined,
  };
}

export function normalizeCodexMcpAuthStatus(value: unknown): ServerMcpServerAuthStatus {
  if (value === "unsupported") return "unsupported";
  if (value === "notLoggedIn") return "not_logged_in";
  if (value === "bearerToken") return "bearer_token";
  if (value === "oAuth") return "o_auth";
  return "unknown";
}

export function parseCodexMcpServerEnabledStates(content: string): ReadonlyMap<string, boolean> {
  const enabledByServer = new Map<string, boolean>();
  let currentServerName: string | null = null;
  let inServerRootSection = false;

  const flushServerSection = () => {
    if (!currentServerName || enabledByServer.has(currentServerName)) {
      return;
    }
    enabledByServer.set(currentServerName, true);
  };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const sectionMatch = /^\[([^\]]+)\]$/.exec(trimmed);
    if (sectionMatch) {
      flushServerSection();
      const sectionName = sectionMatch[1] ?? "";
      const serverSection = parseServerSection(sectionName);
      if (serverSection) {
        currentServerName = serverSection.name;
        inServerRootSection = serverSection.isRoot;
        continue;
      }

      currentServerName = null;
      inServerRootSection = false;
      continue;
    }

    if (!currentServerName || !inServerRootSection) {
      continue;
    }

    const enabledMatch = /^enabled\s*=\s*(true|false)\s*$/i.exec(trimmed);
    if (enabledMatch) {
      enabledByServer.set(currentServerName, enabledMatch[1]?.toLowerCase() === "true");
    }
  }

  flushServerSection();
  return enabledByServer;
}

async function readCodexMcpServerEnabledStates(input?: {
  readonly homePath?: string;
}): Promise<ReadonlyMap<string, boolean>> {
  const codexHome = input?.homePath ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const configPath = path.join(codexHome, "config.toml");
  try {
    const content = await readFile(configPath, "utf8");
    return parseCodexMcpServerEnabledStates(content);
  } catch {
    return new Map();
  }
}

function buildRpcPayload(id: number, method: string, params?: unknown) {
  return JSON.stringify(params === undefined ? { id, method } : { id, method, params });
}

async function listCodexRuntimeMcpStatuses(input?: {
  readonly binaryPath?: string;
  readonly cwd?: string;
  readonly homePath?: string;
  readonly timeoutMs?: number;
}): Promise<ReadonlyArray<CodexRuntimeMcpServerStatus>> {
  const binaryPath = input?.binaryPath ?? DEFAULT_CODEX_BINARY;
  const cwd = input?.cwd ?? process.cwd();
  const timeoutMs = input?.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const child = spawn(binaryPath, ["app-server"], {
    cwd,
    env: {
      ...process.env,
      ...(input?.homePath ? { CODEX_HOME: input.homePath } : {}),
    },
    shell: process.platform === "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });

  let nextRequestId = 1;
  let stderrOutput = "";
  const pending = new Map<
    number,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
      readonly timer: ReturnType<typeof setTimeout>;
    }
  >();

  const cleanup = () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
    }
    pending.clear();
    output.close();
    child.stdout.destroy();
    child.stderr.destroy();
    child.stdin.end();
    if (!child.killed) {
      child.kill();
    }
  };

  const failPending = (error: Error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  };

  const output = readline.createInterface({ input: child.stdout });
  output.on("line", (line) => {
    let parsed: CodexJsonRpcResponse;
    try {
      parsed = JSON.parse(line) as CodexJsonRpcResponse;
    } catch {
      return;
    }

    if (typeof parsed.id !== "number") {
      return;
    }

    const pendingRequest = pending.get(parsed.id);
    if (!pendingRequest) {
      return;
    }

    clearTimeout(pendingRequest.timer);
    pending.delete(parsed.id);

    if (parsed.error) {
      pendingRequest.reject(
        new Error(parsed.error.message ?? `Codex app-server request '${parsed.id}' failed.`),
      );
      return;
    }

    pendingRequest.resolve(parsed.result);
  });

  child.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  child.once("error", (error) => {
    failPending(error instanceof Error ? error : new Error(String(error)));
  });

  child.once("exit", (code, signal) => {
    if (pending.size === 0) {
      return;
    }
    const detail =
      stderrOutput.trim() ||
      (signal ? `exited with signal ${signal}` : `exited with code ${String(code ?? "unknown")}`);
    failPending(new Error(`Codex app-server closed before responding: ${detail}`));
  });

  const sendRequest = (method: string, params?: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = nextRequestId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for Codex app-server response to '${method}'.`));
      }, timeoutMs);

      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${buildRpcPayload(id, method, params)}\n`);
    });

  try {
    await sendRequest("initialize", buildCodexInitializeParams());
    child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);

    try {
      await sendRequest("config/mcpServer/reload");
    } catch {
      // Older app-server builds or transient config issues should not block status reads.
    }

    const statuses: CodexRuntimeMcpServerStatus[] = [];
    let cursor: string | null = null;

    while (true) {
      const result = (await sendRequest("mcpServerStatus/list", {
        cursor,
        limit: DEFAULT_PAGE_LIMIT,
      })) as CodexListMcpStatusResponse;

      const pageData = Array.isArray(result?.data) ? result.data : [];
      for (const entry of pageData) {
        if (!isRecord(entry) || typeof entry.name !== "string" || entry.name.trim().length === 0) {
          continue;
        }
        const tools = isRecord(entry.tools) ? entry.tools : {};
        const resources = Array.isArray(entry.resources) ? entry.resources : [];
        const resourceTemplates = Array.isArray(entry.resourceTemplates)
          ? entry.resourceTemplates
          : [];
        statuses.push({
          name: entry.name.trim(),
          authStatus: normalizeCodexMcpAuthStatus(entry.authStatus),
          toolCount: Object.keys(tools).length,
          resourceCount: resources.length,
          resourceTemplateCount: resourceTemplates.length,
        });
      }

      cursor =
        typeof result?.nextCursor === "string" && result.nextCursor.length > 0
          ? result.nextCursor
          : null;
      if (!cursor) {
        break;
      }
    }

    return statuses;
  } finally {
    cleanup();
  }
}

export function mergeCodexMcpServerStatuses(
  configuredServers: ReadonlyMap<string, boolean>,
  runtimeStatuses: ReadonlyArray<CodexRuntimeMcpServerStatus>,
): ReadonlyArray<ServerMcpServerStatus> {
  const merged = new Map<string, ServerMcpServerStatus>();

  for (const [name, enabled] of configuredServers) {
    merged.set(name, {
      name,
      enabled,
      state: enabled ? "enabled" : "disabled",
      authStatus: "unknown",
      toolCount: 0,
      resourceCount: 0,
      resourceTemplateCount: 0,
    });
  }

  for (const status of runtimeStatuses) {
    merged.set(status.name, {
      name: status.name,
      enabled: true,
      state: "enabled",
      authStatus: status.authStatus,
      toolCount: status.toolCount,
      resourceCount: status.resourceCount,
      resourceTemplateCount: status.resourceTemplateCount,
    });
  }

  return [...merged.values()].toSorted((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function listCodexMcpServerStatuses(input?: {
  readonly binaryPath?: string;
  readonly cwd?: string;
  readonly homePath?: string;
  readonly timeoutMs?: number;
}): Promise<ReadonlyArray<ServerMcpServerStatus>> {
  const configuredServers = await readCodexMcpServerEnabledStates(input);
  if (configuredServers.size === 0) {
    return [];
  }

  try {
    const runtimeStatuses = await listCodexRuntimeMcpStatuses(input);
    return mergeCodexMcpServerStatuses(configuredServers, runtimeStatuses);
  } catch {
    return mergeCodexMcpServerStatuses(configuredServers, []);
  }
}
