import type { GroundedClaim } from "../grounding/types";
import type { ValidatedCategoryGapResult } from "./generation-schema";

export function atomicGapGroundedClaims(
  findings: ValidatedCategoryGapResult[],
): GroundedClaim[] {
  return findings.flatMap<GroundedClaim>((finding) =>
    finding.gaps.length > 0
      ? finding.gaps.map((gap, index) => ({
          key: `atomic-gap:${finding.requirementCode}:${gap.questionStableKey}:${index + 1}`,
          queryUnitId: finding.requirementCode,
          kind: "organization",
          binding: false,
          citationIds: gap.citationIds,
          text: gap.statement,
        }))
      : [
          {
            key: `atomic-gap:${finding.requirementCode}:no-gap`,
            queryUnitId: finding.requirementCode,
            kind: "legal",
            binding: true,
            citationIds: [finding.legalCitationId],
            text: `${finding.requirementCode}: no triggering atomic gaps`,
          },
        ],
  );
}
