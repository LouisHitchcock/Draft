import type { ThreadTask } from "../../session-logic";

function formatCount(count: number, label: string): string {
  return `${count} ${label}`;
}

export function formatTaskActivitySummary(
  tasks: ReadonlyArray<Pick<ThreadTask, "status">>,
): string {
  const counts = {
    running: 0,
    completed: 0,
    failed: 0,
    stopped: 0,
  };

  for (const task of tasks) {
    counts[task.status] += 1;
  }

  const parts: string[] = [];
  if (counts.running > 0) {
    parts.push(formatCount(counts.running, "running"));
  }
  if (counts.completed > 0) {
    parts.push(formatCount(counts.completed, "completed"));
  }
  if (counts.failed > 0) {
    parts.push(formatCount(counts.failed, "failed"));
  }
  if (counts.stopped > 0) {
    parts.push(formatCount(counts.stopped, "stopped"));
  }

  return parts.join(" · ");
}
