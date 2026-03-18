import type { ServerOpenCodeState, ServerOpenCodeStateInput } from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface OpenCodeStateShape {
  readonly getState: (input?: ServerOpenCodeStateInput) => Effect.Effect<ServerOpenCodeState>;
}

export class OpenCodeState extends ServiceMap.Service<OpenCodeState, OpenCodeStateShape>()(
  "cut3/provider/Services/OpenCodeState",
) {}
