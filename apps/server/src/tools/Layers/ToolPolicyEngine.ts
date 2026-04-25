import { ToolInvocation, type ToolPolicyDecision } from "@draft/contracts";
import { Effect, Layer, Schema } from "effect";

import { ToolHarnessValidationError } from "../Errors.ts";
import { ToolPolicyEngine, type ToolPolicyContext, type ToolPolicyEngineShape } from "../Services/ToolPolicyEngine.ts";

const decodeToolInvocation = Schema.decodeUnknownSync(ToolInvocation);

function normalizePolicyDefaultAction(raw: string | undefined): ToolPolicyDecision["action"] {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "ask" || normalized === "deny") {
    return normalized;
  }
  return "allow";
}

function isRiskyTool(invocation: ReturnType<typeof decodeToolInvocation>): boolean {
  if (invocation.toolName === "apply_patch") {
    return true;
  }
  if (invocation.toolName === "terminal.exec") {
    if (!invocation.input || typeof invocation.input !== "object" || Array.isArray(invocation.input)) {
      return true;
    }
    const value = invocation.input as { isRisky?: unknown };
    return value.isRisky === true;
  }
  return false;
}

const decidePolicy = (
  _context: ToolPolicyContext,
  rawInvocation: unknown,
): Effect.Effect<ToolPolicyDecision, ToolHarnessValidationError> =>
  Effect.try({
    try: () => decodeToolInvocation(rawInvocation),
    catch: (cause) =>
      new ToolHarnessValidationError({
        operation: "ToolPolicyEngine.decide",
        issue: "Invalid tool invocation payload",
        cause,
      }),
  }).pipe(
    Effect.map((invocation) => {
      const defaultAction = normalizePolicyDefaultAction(process.env.DRAFT_TOOL_POLICY_DEFAULT_ACTION);
      if (isRiskyTool(invocation)) {
        return {
          action: "ask",
          reason: "Risky tool invocation requires approval.",
        } satisfies ToolPolicyDecision;
      }
      return {
        action: defaultAction,
        ...(defaultAction === "allow" ? {} : { reason: "Policy requires explicit approval." }),
      } satisfies ToolPolicyDecision;
    }),
  );

export const ToolPolicyEngineLive = Layer.succeed(
  ToolPolicyEngine,
  {
    decide: decidePolicy,
  } satisfies ToolPolicyEngineShape,
);
