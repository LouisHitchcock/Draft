import {
  ThreadId,
  type ToolInvocation,
  type ToolPolicyDecision,
  type ToolsExecuteInput,
  type ToolsExecuteResult,
} from "@draft/contracts";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { ToolPolicyEngine } from "../Services/ToolPolicyEngine.ts";
import { ToolRegistry } from "../Services/ToolRegistry.ts";
import type { ToolExecutorShape } from "../Services/ToolExecutor.ts";
import { ToolExecutor } from "../Services/ToolExecutor.ts";
import { ToolExecutorLive } from "./ToolExecutor.ts";

const makeExecutor = (input: {
  readonly execute: (invocation: ToolInvocation) => unknown;
  readonly decide?: (invocation: ToolInvocation) => ToolPolicyDecision;
}) =>
  Effect.gen(function* () {
    return yield* ToolExecutor;
  }).pipe(
    Effect.provide(
      ToolExecutorLive.pipe(
        Layer.provide(
          Layer.succeed(ToolRegistry, {
            execute: (_context, invocation) => Effect.succeed(input.execute(invocation)),
          }),
        ),
        Layer.provide(
          Layer.succeed(ToolPolicyEngine, {
            decide: (_context, invocation) =>
              Effect.succeed(input.decide?.(invocation) ?? { action: "allow" }),
          }),
        ),
      ),
    ),
  );

async function runExecute(
  executor: ToolExecutorShape,
  input: ToolsExecuteInput,
): Promise<ToolsExecuteResult> {
  return await Effect.runPromise(executor.execute(input));
}

describe("ToolExecutorLive", () => {
  it("executes successful tool invocations", async () => {
    const executor = await Effect.runPromise(
      makeExecutor({
        execute: (invocation) => ({ ok: true, toolName: invocation.toolName }),
      }),
    );
    const result = await runExecute(executor, {
      threadId: ThreadId.makeUnsafe("thread-1"),
      executionMode: "auto",
      invocations: [
        {
          toolCallId: "call-1",
          toolName: "grep",
          input: { query: "needle" },
        },
      ],
    });
    expect(result.status).toBe("succeeded");
    expect(result.results[0]?.status).toBe("succeeded");
  });

  it("blocks invocation when policy asks for approval", async () => {
    const executor = await Effect.runPromise(
      makeExecutor({
        execute: () => ({ ok: true }),
        decide: () => ({ action: "ask", reason: "approval required" }),
      }),
    );
    const result = await runExecute(executor, {
      threadId: ThreadId.makeUnsafe("thread-2"),
      executionMode: "auto",
      invocations: [
        {
          toolCallId: "call-1",
          toolName: "apply_patch",
          input: {},
        },
      ],
    });
    expect(result.status).toBe("partial");
    expect(result.results[0]?.status).toBe("blocked");
  });
});
