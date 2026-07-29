export type GenerationMetric = {
  name:
    | "category_initial_accepted"
    | "category_repair_requested"
    | "category_repair_accepted"
    | "category_repair_exhausted"
    | "sibling_provider_aborted"
    | "primary_failure_settlement_ms"
    | "orphan_runs_reconciled"
    | "atomic_finalization_failure";
  value: number;
  jobId?: string;
  runId?: string;
  categoryCode?: string;
  phase?: "initial" | "repair";
  safeCode?: string;
  state?: string;
};

export function emitGenerationMetric(metric: GenerationMetric) {
  console.info("Generation lifecycle metric", metric);
}
