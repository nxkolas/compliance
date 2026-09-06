export type PlanPreparationState =
  | "applicability_missing" | "applicability_review" | "gap_pending" | "gap_generating"
  | "review" | "no_gaps" | "permission" | "outdated" | "unavailable"
  | "ready" | "generating" | "failed";

export type PlanGenerationJob = { id: string; state: string };

export function resolvePlanPreparation(input: {
  prerequisite: { satisfied: boolean; status: string };
  revision: { id: string } | null;
  lifecycle: { canFinalize: boolean };
  lifecycleMode: string;
  canManage: boolean;
  gapCounts: Record<string, number>;
  reviewBlockers: string[];
  staleness?: { outdated: boolean } | null;
}, job: PlanGenerationJob | null = null): PlanPreparationState {
  // An existing job must not be hidden behind a prerequisite or permission notice.
  if (job && ["queued", "leased", "running"].includes(job.state)) return "generating";
  if (!input.revision) {
    if (input.prerequisite.status === "missing") return "applicability_missing";
    if (!input.prerequisite.satisfied) return "applicability_review";
    return input.lifecycleMode === "generating" ? "gap_generating" : "gap_pending";
  }
  if (input.staleness?.outdated) return "outdated";
  if (input.reviewBlockers.length) return "review";
  const total = input.gapCounts.all ?? 0;
  const fulfilled = input.gapCounts.fulfilled ?? 0;
  if (total === 0) return "unavailable";
  if (total === fulfilled) return "no_gaps";
  if (!input.canManage) return "permission";
  if (!input.lifecycle.canFinalize) return "unavailable";
  if (job && ["failed", "cancelled"].includes(job.state)) return "failed";
  return "ready";
}
