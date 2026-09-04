import type { Dictionary, Locale } from "@/src/i18n";
import type { getGapAnalysisWorkflow } from "@/src/server/modules/gap-analysis/workflow-reader";

export type GapWorkflow = Awaited<
  ReturnType<typeof getGapAnalysisWorkflow>
>;
export type GapLabels = Dictionary["modules"]["gapAnalysis"]["workflow"];
export type GapLocale = Locale;
