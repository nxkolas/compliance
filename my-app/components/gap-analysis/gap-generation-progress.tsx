"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { JobDto } from "@/src/contracts/common/jobs";
import type { GapLabels } from "./types";

export function GapGenerationProgress({
  labels,
  job,
  cancelling,
  canCancel,
  onCancel,
}: {
  labels: GapLabels;
  job: JobDto | null;
  cancelling: boolean;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const phaseLabel = job?.phase === "preparing_evidence"
    ? labels.preparingEvidence
    : job?.phase === "generating_categories" && job.completedUnits !== null && job.totalUnits !== null
      ? labels.generatingCategories
          .replace("{completed}", String(job.completedUnits))
          .replace("{total}", String(job.totalUnits))
      : job?.phase === "validating"
        ? labels.validatingAnalysis
        : job?.phase === "saving_result"
        ? labels.savingResult
        : labels.generating;
  const waitingForClient = job?.waitingOnClient === true;
  return (
    <div
      className="rounded-lg border border-primary/35 bg-primary/10 p-5 text-foreground"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-primary" />
        <div>
          <p className="font-semibold">
            {waitingForClient ? labels.waitingForClient : phaseLabel}
          </p>
          <p className="mt-1 text-sm">
            {waitingForClient
              ? labels.waitingForClientHint
              : labels.generationProgress}
          </p>
        </div>
      </div>
      {job ? (
        <Progress
          className="mt-4 h-2"
          value={job.progress}
          aria-label={phaseLabel}
        />
      ) : null}
      {canCancel ? (
        <Button
          className="mt-4"
          variant="outline"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling ? <Loader2 className="animate-spin" /> : null}
          {labels.cancelGeneration}
        </Button>
      ) : null}
    </div>
  );
}
