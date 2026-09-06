export type DocumentUsageLabel =
  | "not_assessed"
  | "used_in_open_draft"
  | "used_in_candidate_revision"
  | "used_in_approved_revision"
  | "supports_active_plan";

export function deriveDocumentUsageLabels(input: {
  versionId: string;
  artifactSources: Array<{
    documentVersionId: string;
    revisionId: string;
    currentRevisionId: string | null;
    acceptedRevisionId: string | null;
  }>;
  draftVersionIds: Set<string>;
  activePlanVersionIds: Set<string>;
}): DocumentUsageLabel[] {
  const labels = new Set<DocumentUsageLabel>();
  if (input.draftVersionIds.has(input.versionId)) {
    labels.add("used_in_open_draft");
  }
  for (const source of input.artifactSources) {
    if (source.documentVersionId !== input.versionId) continue;
    if (source.revisionId === source.acceptedRevisionId) {
      labels.add("used_in_approved_revision");
    }
    if (
      source.revisionId === source.currentRevisionId &&
      source.currentRevisionId !== source.acceptedRevisionId
    ) {
      labels.add("used_in_candidate_revision");
    }
  }
  if (input.activePlanVersionIds.has(input.versionId)) {
    labels.add("supports_active_plan");
  }
  return labels.size ? [...labels] : ["not_assessed"];
}
