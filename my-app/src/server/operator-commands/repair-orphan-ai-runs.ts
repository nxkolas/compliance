import {
  listTerminalParentProcessingRuns,
  readGenerationLifecycleInvariants,
  reconcileTerminalParentProcessingRuns,
} from "../jobs";
import { closeDbConnection } from "@/src/db";

export async function repairOrphanAiRuns(input: {
  apply?: boolean;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(1_000, Math.trunc(input.limit ?? 100)));
  const selected = await listTerminalParentProcessingRuns(limit);
  if (!input.apply) {
    return {
      mode: "dry-run" as const,
      selected: selected.length,
      changed: 0,
      skipped: 0,
      remaining: selected.length,
      runs: selected,
      invariants: await readGenerationLifecycleInvariants(),
    };
  }
  const applied = await reconcileTerminalParentProcessingRuns({
    limit,
    runIds: selected.map((candidate) => candidate.runId),
  });
  const remaining = await listTerminalParentProcessingRuns(limit);
  return {
    mode: "apply" as const,
    selected: selected.length,
    changed: applied.changed,
    skipped: Math.max(0, selected.length - applied.changed),
    remaining: remaining.length,
    runs: applied.runs,
    invariants: await readGenerationLifecycleInvariants(),
  };
}

export function closeOrphanAiRunRepairConnection() {
  return closeDbConnection();
}
