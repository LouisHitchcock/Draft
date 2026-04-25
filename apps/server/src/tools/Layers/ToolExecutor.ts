import { EventEmitter } from "node:events";

import {
  ToolsExecuteInput,
  type ToolEvent,
  type ToolResult,
  type ToolsExecuteResult,
  type ToolPolicyDecision,
} from "@draft/contracts";
import { Effect, Layer, Schema } from "effect";

import { ToolExecutionError, ToolRunNotFoundError } from "../Errors.ts";
import { ToolExecutor, type ToolExecutorShape } from "../Services/ToolExecutor.ts";
import { ToolPolicyEngine, type ToolPolicyEngineShape } from "../Services/ToolPolicyEngine.ts";
import { ToolRegistry, type ToolRegistryShape } from "../Services/ToolRegistry.ts";

const decodeToolsExecuteInput = Schema.decodeUnknownSync(ToolsExecuteInput);

interface ToolExecutorEvents {
  event: [event: ToolEvent];
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Tool execution failed";
}

function buildBlockedResult(input: {
  readonly invocation: ToolsExecuteInput["invocations"][number];
  readonly startedAt: string;
  readonly policy: ToolPolicyDecision;
  readonly reason?: string;
}): ToolResult {
  const completedAt = nowIso();
  return {
    toolCallId: input.invocation.toolCallId,
    toolName: input.invocation.toolName,
    status: "blocked",
    startedAt: input.startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(input.startedAt)),
    policy: input.policy,
    ...(input.reason ? { error: input.reason } : {}),
  };
}

class ToolExecutorRuntime extends EventEmitter<ToolExecutorEvents> {
  private readonly runs = new Map<string, ToolsExecuteResult>();

  constructor(
    private readonly toolRegistry: ToolRegistryShape,
    private readonly toolPolicyEngine: ToolPolicyEngineShape,
  ) {
    super();
  }

  subscribe(listener: (event: ToolEvent) => void): () => void {
    this.on("event", listener);
    return () => {
      this.off("event", listener);
    };
  }

  private emitEvent(event: ToolEvent): void {
    this.emit("event", event);
  }

  async execute(raw: ToolsExecuteInput): Promise<ToolsExecuteResult> {
    const input = decodeToolsExecuteInput(raw);
    const runId = `tool-run-${crypto.randomUUID()}`;
    const startedAt = nowIso();
    const results: ToolResult[] = [];
    const resultsByInvocation = new Map<string, ToolResult>();

    for (const invocation of input.invocations) {
      const invocationStartedAt = nowIso();
      const blockedDependency = (invocation.dependsOn ?? []).find((dependencyId) => {
        const dependencyResult = resultsByInvocation.get(dependencyId);
        return !dependencyResult || dependencyResult.status !== "succeeded";
      });
      if (blockedDependency) {
        const blockedResult = buildBlockedResult({
          invocation,
          startedAt: invocationStartedAt,
          policy: {
            action: "deny",
            reason: `Blocked by dependency '${blockedDependency}'`,
          },
          reason: `Dependency '${blockedDependency}' did not succeed.`,
        });
        results.push(blockedResult);
        resultsByInvocation.set(invocation.toolCallId, blockedResult);
        this.emitEvent({
          type: "tool.completed",
          runId,
          threadId: input.threadId,
          ...(input.turnId ? { turnId: input.turnId } : {}),
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          createdAt: blockedResult.completedAt,
          result: blockedResult,
        });
        continue;
      }

      this.emitEvent({
        type: "tool.started",
        runId,
        threadId: input.threadId,
        ...(input.turnId ? { turnId: input.turnId } : {}),
        toolCallId: invocation.toolCallId,
        toolName: invocation.toolName,
        createdAt: invocationStartedAt,
      });

      try {
        const policy = await Effect.runPromise(
          this.toolPolicyEngine.decide(
            {
              threadId: input.threadId,
              ...(input.turnId ? { turnId: input.turnId } : {}),
            },
            invocation,
          ),
        );
        if (policy.action !== "allow") {
          const blockedResult = buildBlockedResult({
            invocation,
            startedAt: invocationStartedAt,
            policy,
            reason: policy.reason ?? "Tool invocation blocked by policy.",
          });
          results.push(blockedResult);
          resultsByInvocation.set(invocation.toolCallId, blockedResult);
          this.emitEvent({
            type: "tool.error",
            runId,
            threadId: input.threadId,
            ...(input.turnId ? { turnId: input.turnId } : {}),
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            createdAt: blockedResult.completedAt,
            message: blockedResult.error ?? "Blocked by policy",
          });
          this.emitEvent({
            type: "tool.completed",
            runId,
            threadId: input.threadId,
            ...(input.turnId ? { turnId: input.turnId } : {}),
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            createdAt: blockedResult.completedAt,
            result: blockedResult,
          });
          continue;
        }

        const output = await Effect.runPromise(
          this.toolRegistry.execute(
            {
              threadId: input.threadId,
              ...(input.turnId ? { turnId: input.turnId } : {}),
            },
            invocation,
          ),
        );

        const completedAt = nowIso();
        const result: ToolResult = {
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          status: "succeeded",
          startedAt: invocationStartedAt,
          completedAt,
          durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(invocationStartedAt)),
          policy,
          output,
        };
        results.push(result);
        resultsByInvocation.set(invocation.toolCallId, result);
        this.emitEvent({
          type: "tool.output",
          runId,
          threadId: input.threadId,
          ...(input.turnId ? { turnId: input.turnId } : {}),
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          createdAt: completedAt,
          data: output,
        });
        this.emitEvent({
          type: "tool.completed",
          runId,
          threadId: input.threadId,
          ...(input.turnId ? { turnId: input.turnId } : {}),
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          createdAt: completedAt,
          result,
        });
      } catch (error) {
        const completedAt = nowIso();
        const message = normalizeErrorMessage(error);
        const result: ToolResult = {
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          status: "failed",
          startedAt: invocationStartedAt,
          completedAt,
          durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(invocationStartedAt)),
          policy: {
            action: "allow",
          },
          error: message,
        };
        results.push(result);
        resultsByInvocation.set(invocation.toolCallId, result);
        this.emitEvent({
          type: "tool.error",
          runId,
          threadId: input.threadId,
          ...(input.turnId ? { turnId: input.turnId } : {}),
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          createdAt: completedAt,
          message,
        });
        this.emitEvent({
          type: "tool.completed",
          runId,
          threadId: input.threadId,
          ...(input.turnId ? { turnId: input.turnId } : {}),
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          createdAt: completedAt,
          result,
        });
      }
    }

    const completedAt = nowIso();
    const hasFailed = results.some((result) => result.status === "failed");
    const hasBlocked = results.some((result) => result.status === "blocked");
    const status: ToolsExecuteResult["status"] = hasFailed ? "failed" : hasBlocked ? "partial" : "succeeded";
    const runResult: ToolsExecuteResult = {
      runId,
      threadId: input.threadId,
      ...(input.turnId ? { turnId: input.turnId } : {}),
      status,
      startedAt,
      completedAt,
      results,
    };
    this.runs.set(runId, runResult);
    return runResult;
  }

  getResult(runId: string): ToolsExecuteResult {
    const result = this.runs.get(runId);
    if (!result) {
      throw new ToolRunNotFoundError({ runId });
    }
    return result;
  }
}

const makeToolExecutor = Effect.gen(function* () {
  const toolRegistry = yield* ToolRegistry;
  const toolPolicyEngine = yield* ToolPolicyEngine;
  const runtime = new ToolExecutorRuntime(toolRegistry, toolPolicyEngine);

  return {
    execute: (input) =>
      Effect.tryPromise({
        try: () => runtime.execute(input),
        catch: (cause) =>
          Schema.is(ToolRunNotFoundError)(cause) || Schema.is(ToolExecutionError)(cause)
            ? cause
            : new ToolExecutionError({
                toolName: "tool-executor",
                detail: normalizeErrorMessage(cause),
                cause,
              }),
      }),
    getResult: (input) =>
      Effect.try({
        try: () => runtime.getResult(input.runId),
        catch: (cause) =>
          Schema.is(ToolRunNotFoundError)(cause)
            ? cause
            : new ToolExecutionError({
                toolName: "tool-executor",
                detail: normalizeErrorMessage(cause),
                cause,
              }),
      }),
    subscribe: (listener) => Effect.sync(() => runtime.subscribe(listener)),
  } satisfies ToolExecutorShape;
});

export const ToolExecutorLive = Layer.effect(ToolExecutor, makeToolExecutor);
