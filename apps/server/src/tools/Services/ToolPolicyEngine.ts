import type { ToolInvocation, ToolPolicyDecision } from "@draft/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ToolHarnessValidationError } from "../Errors.ts";

export interface ToolPolicyContext {
  readonly threadId: string;
  readonly turnId?: string | undefined;
}

export interface ToolPolicyEngineShape {
  readonly decide: (
    context: ToolPolicyContext,
    invocation: ToolInvocation,
  ) => Effect.Effect<ToolPolicyDecision, ToolHarnessValidationError>;
}

export class ToolPolicyEngine extends ServiceMap.Service<ToolPolicyEngine, ToolPolicyEngineShape>()(
  "draft/tools/Services/ToolPolicyEngine",
) {}
