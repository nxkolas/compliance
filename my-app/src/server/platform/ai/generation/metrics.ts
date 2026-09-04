export type GenerationMetric = {
  name:
    | "category_initial_accepted"
    | "category_repair_requested"
    | "category_repair_accepted"
    | "category_repair_exhausted"
    | "sibling_provider_aborted"
    | "primary_failure_settlement_ms"
    | "orphan_runs_reconciled"
    | "atomic_finalization_failure"
    | "legal_retrieval_ms"
    | "organization_retrieval_ms"
    | "retrieval_wall_ms"
    | "provider_attempt_ms"
    | "validation_ms"
    | "persistence_ms"
    | "job_queue_delay_ms"
    | "job_total_ms"
    | "embedding_call_ms"
    | "provider_permit_wait_ms";
  value: number;
  jobId?: string;
  runId?: string;
  categoryCode?: string;
  phase?: "initial" | "repair";
  safeCode?: string;
  state?: string;
  batchSize?: number;
  callCount?: number;
};

export function emitGenerationMetric(metric: GenerationMetric) {
  console.info("Generation lifecycle metric", metric);
}
