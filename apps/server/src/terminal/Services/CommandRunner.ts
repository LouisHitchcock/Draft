/**
 * TerminalCommandRunner - Structured terminal command execution service.
 *
 * Executes one-off terminal commands in `wait` or `interact` mode and emits
 * command lifecycle events for websocket fanout.
 *
 * @module TerminalCommandRunner
 */
import { TerminalExecEvent, TerminalExecInput, TerminalExecResult } from "@draft/contracts";
import { Effect, Schema, ServiceMap } from "effect";

export class TerminalCommandRunnerError extends Schema.TaggedErrorClass<TerminalCommandRunnerError>()(
  "TerminalCommandRunnerError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface TerminalCommandRunnerShape {
  readonly exec: (
    input: TerminalExecInput,
  ) => Effect.Effect<TerminalExecResult, TerminalCommandRunnerError>;
  readonly subscribe: (listener: (event: TerminalExecEvent) => void) => Effect.Effect<() => void>;
}

export class TerminalCommandRunner extends ServiceMap.Service<
  TerminalCommandRunner,
  TerminalCommandRunnerShape
>()("draft/terminal/Services/CommandRunner/TerminalCommandRunner") {}
