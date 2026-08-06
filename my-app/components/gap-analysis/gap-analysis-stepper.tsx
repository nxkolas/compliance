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
  variant = "default",
}: {
  activeStep: GapWorkflowStep;
  availableSteps: GapWorkflowStep[];
  labels: GapLabels;
  onNavigate: (step: GapWorkflowStep) => void;
  variant?: "default" | "questionnaire";
}) {
  const furthestAvailableIndex = Math.max(
    ...availableSteps.map((step) => steps.indexOf(step)),
  );
  return (
    <nav
      aria-label={labels.resultTitle}
      data-gap-stepper-variant={variant}
      className={variant === "questionnaire" ? "w-full max-w-[1130px]" : undefined}
    >
      <ol
        className={
          variant === "questionnaire"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            : "grid gap-2 sm:grid-cols-4"
        }
      >
        {steps.map((step, index) => {
          const available = availableSteps.includes(step);
          const completed = available && index < furthestAvailableIndex;
          return (
            <li key={step}>
              <button
                type="button"
                className={
                  variant === "questionnaire"
                    ? `flex h-10 w-full items-center gap-3 rounded-lg border-[1.5px] px-5 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                        activeStep === step || completed
                          ? "text-white"
                          : "text-slate-400"
                      }`
                    : "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                }
                style={
                  variant === "questionnaire"
                    ? {
                        background:
                          "linear-gradient(rgba(0, 43, 255, 0.13), rgba(0, 43, 255, 0.13)), linear-gradient(135deg, #111825 0%, #1A2540 100%)",
                        borderColor: "rgba(251, 251, 251, 0.09)",
                      }
                    : undefined
                }
                aria-current={activeStep === step ? "step" : undefined}
                disabled={!available}
                onClick={() => onNavigate(step)}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                    completed
                      ? variant === "questionnaire"
                        ? "border-transparent bg-[#46A95A] text-white outline outline-1 outline-offset-[-1px] outline-black"
                        : "border-success bg-success/10 text-success-foreground"
                      : activeStep === step
                        ? variant === "questionnaire"
                          ? "border-[#002BFF] bg-[#002BFF] text-white"
                          : "border-primary bg-primary text-primary-foreground"
                        : variant === "questionnaire"
                          ? "border-[#002BFF] bg-[#002BFF] text-white"
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
