import { ApiError } from "@/src/server/api/errors";

type CurrentRevision = { currentRevisionId: string | null } | null | undefined;

export function resolveReportInputRevisions(input: {
  applicability: CurrentRevision;
  gap: CurrentRevision;
}) {
  if (!input.applicability?.currentRevisionId) {
    throw new ApiError(
      409,
      "Complete the applicability check before creating a report",
      undefined,
      "REPORT_INPUTS_INCOMPLETE",
    );
  }

  return {
    applicabilityRevisionId: input.applicability.currentRevisionId,
    gapRevisionId: input.gap?.currentRevisionId ?? null,
  };
}
