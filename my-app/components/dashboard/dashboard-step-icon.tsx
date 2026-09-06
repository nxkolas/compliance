import { ApplicabilityCheckIcon, GapAnalysisIcon } from "@/components/workflow-icons";

/** Share the sidebar symbols in every completion state. */
export function DashboardStepIcon({ step }: { step: number }) {
  if (step === 0) return <ApplicabilityCheckIcon className="h-[19px] w-[18px]" />;
  if (step === 1) return <GapAnalysisIcon className="h-[11px] w-[19px]" />;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 7.2V10M10 12.8H10.0075M10 17C10 17 16 14.2 16 10V5.1L10 3L4 5.1V10C4 14.2 10 17 10 17Z" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
