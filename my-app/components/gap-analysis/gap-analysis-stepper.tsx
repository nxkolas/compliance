"use client";

import type { GapWorkflowStep } from "@/src/server/gap-analysis/workflow-state";
import type { GapLabels } from "./types";

const steps: GapWorkflowStep[] = [
  "questions",
  "documents",
  "review",
  "gaps",
];

export function GapAnalysisStepper({
  activeStep,
  availableSteps,
  labels,
  onNavigate,
}: {
  activeStep: GapWorkflowStep;
  availableSteps: GapWorkflowStep[];
  labels: GapLabels;
  onNavigate: (step: GapWorkflowStep) => void;
}) {
  const activeIndex = steps.indexOf(activeStep);
  const furthestAvailableIndex = Math.max(
    ...availableSteps.map((step) => steps.indexOf(step)),
  );
  return (
    <nav aria-label={labels.resultTitle}>
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const available = availableSteps.includes(step);
          const completed =
            available && index < furthestAvailableIndex && index !== activeIndex;
          return (
            <li key={step}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                aria-current={activeStep === step ? "step" : undefined}
                disabled={!available}
                onClick={() => onNavigate(step)}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                    activeStep === step
                      ? "border-primary bg-primary text-primary-foreground"
                      : completed
                        ? "border-success bg-success/10 text-success-foreground"
                        : ""
                  }`}
                >
                  {index + 1}
                </span>
                <span className="font-medium">{labels.steps[step]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
