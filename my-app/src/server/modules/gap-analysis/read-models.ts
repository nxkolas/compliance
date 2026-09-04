import type { Locale } from "@/lib/i18n-config";
import { getGapAnalysisRevision, getGapAnalysisWorkflow } from "./workflow-reader";

export async function getGapHistory(userId: string, organizationId: string, locale: Locale = "de") {
  return (await getGapAnalysisWorkflow({ userId, organizationId, locale, view: "history" })).history;
}

export async function getGapInputs(
  userId: string,
  organizationId: string,
  revisionId: string,
  locale: Locale = "de",
) {
  const workflow = await getGapAnalysisWorkflow({ userId, organizationId, locale, view: "inputs" });
  return workflow.revision?.id === revisionId ? workflow.generatedInputs : null;
}

export function getGapResults(userId: string, organizationId: string, revisionId: string, locale: Locale = "de") {
  void locale;
  return getGapAnalysisRevision(userId, organizationId, revisionId);
}

export function getGapWorkflowSummary(userId: string, organizationId: string, locale: Locale = "de") {
  return getGapAnalysisWorkflow({ userId, organizationId, locale });
}
