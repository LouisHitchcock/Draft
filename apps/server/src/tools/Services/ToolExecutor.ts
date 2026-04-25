import type {
  ToolEvent,
  ToolsExecuteInput,
  ToolsExecuteResult,
  ToolsGetResultInput,
} from "@draft/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ToolHarnessError } from "../Errors.ts";

export interface ToolExecutorShape {
  readonly execute: (input: ToolsExecuteInput) => Effect.Effect<ToolsExecuteResult, ToolHarnessError>;
  readonly getResult: (
    input: ToolsGetResultInput,
  ) => Effect.Effect<ToolsExecuteResult, ToolHarnessError>;
  readonly subscribe: (listener: (event: ToolEvent) => void) => Effect.Effect<() => void>;
}

export class ToolExecutor extends ServiceMap.Service<ToolExecutor, ToolExecutorShape>()(
  "draft/tools/Services/ToolExecutor",
) {}
