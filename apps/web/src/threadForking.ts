import type { ProviderKind, ThreadForkSource } from "@draft/contracts";

import type { Thread, TurnDiffSummary } from "./types";

function compareTurnDiffSummaries(left: TurnDiffSummary, right: TurnDiffSummary): number {
  const leftTurnCount = left.checkpointTurnCount ?? 0;
  const rightTurnCount = right.checkpointTurnCount ?? 0;
  if (leftTurnCount !== rightTurnCount) {
    return leftTurnCount - rightTurnCount;
  }
  return (
    left.completedAt.localeCompare(right.completedAt) || left.turnId.localeCompare(right.turnId)
  );
}

export function buildForkedThreadTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? `Fork of ${trimmed}` : "Forked thread";
}

export function resolveForkThreadDraftSettings(thread: Thread): {
  provider: ProviderKind;
  model: Thread["model"];
  runtimeMode: Thread["runtimeMode"];
  interactionMode: Thread["interactionMode"];
} {
  return {
    provider: thread.session?.provider ?? thread.provider ?? "codex",
    model: thread.model,
    runtimeMode: thread.runtimeMode,
    interactionMode: thread.interactionMode,
  };
}

export function resolveCheckpointForkSource(summary: TurnDiffSummary): ThreadForkSource | null {
  if (summary.assistantMessageId) {
    return {
      kind: "message",
      messageId: summary.assistantMessageId,
    };
  }
  if (typeof summary.checkpointTurnCount === "number") {
    return {
      kind: "checkpoint",
      turnCount: summary.checkpointTurnCount,
    };
  }
  return null;
}

export function resolveLatestThreadForkSource(thread: Thread): ThreadForkSource {
  const latestStableMessage = [...thread.messages]
    .toReversed()
    .find((message) => !message.streaming);
  if (latestStableMessage) {
    return {
      kind: "message",
      messageId: latestStableMessage.id,
    };
  }

  const latestCheckpoint = [...thread.turnDiffSummaries].toSorted(compareTurnDiffSummaries).at(-1);
  if (latestCheckpoint) {
    return resolveCheckpointForkSource(latestCheckpoint) ?? { kind: "latest" };
  }

  return { kind: "latest" };
}
