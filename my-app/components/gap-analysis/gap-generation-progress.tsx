"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GapLabels } from "./types";

export function GapGenerationProgress({
  labels,
  cancelling,
  canCancel,
  onCancel,
}: {
  labels: GapLabels;
  cancelling: boolean;
  canCancel: boolean;
  onCancel: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-primary/35 bg-primary/10 p-5 text-foreground"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-primary" />
        <div>
          <p className="font-semibold">{labels.generating}</p>
          <p className="mt-1 text-sm">{labels.generationProgress}</p>
        </div>
      </div>
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
