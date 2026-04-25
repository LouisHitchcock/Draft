import type { ToolInvocation } from "@draft/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ToolHarnessError } from "../Errors.ts";

export interface ToolExecutionContext {
  readonly threadId: string;
  readonly turnId?: string | undefined;
}

export interface ToolRegistryShape {
  readonly execute: (
    context: ToolExecutionContext,
    invocation: ToolInvocation,
  ) => Effect.Effect<unknown, ToolHarnessError>;
}

export class ToolRegistry extends ServiceMap.Service<ToolRegistry, ToolRegistryShape>()(
  "draft/tools/Services/ToolRegistry",
) {}
