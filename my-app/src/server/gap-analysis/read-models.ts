import type { Locale } from "@/lib/i18n-config";
import { requireOrganizationCapability } from "../auth/capability-service";
import { loadGapHistoryPreauthorized } from "./history-reader";
import { readGeneratedGapInputs } from "./generated-inputs-reader";
import { getGapAnalysisRevision, getGapAnalysisWorkflow } from "./workflow-reader";

type ReadInput = { userId: string; organizationId: string; locale: Locale };

export function getGapWorkflowSummary(input: ReadInput) {
  return getGapAnalysisWorkflow({ ...input, view: "results" });
}

export function getGapResults(input: ReadInput & { revisionId: string }) {
  return getGapAnalysisRevision(input);
}

export async function getGapInputs(input: ReadInput & { revisionId: string }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:read");
  return readGeneratedGapInputs(input);
}

export async function getGapHistory(input: ReadInput) {
  await requireOrganizationCapability(input.userId, input.organizationId, "gap:read");
  return loadGapHistoryPreauthorized({
    organizationId: input.organizationId,
    currentUserId: input.userId,
    locale: input.locale,
  });
}
