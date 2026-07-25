import { createHash } from "node:crypto";
import type { GroundedClaim, GroundingContextItem, QueryUnit } from "./types";

export type ClaimValidation = GroundedClaim & {
  validation: "supported" | "unsupported" | "conflicting" | "insufficient_information";
  safeFailureReason?: string;
  claimTextHash: string;
};

export function validateGroundedClaims(input: {
  queryUnits: QueryUnit[];
  context: GroundingContextItem[];
  claims: GroundedClaim[];
}) {
  const queryIds = new Set(input.queryUnits.map((unit) => unit.id));
  const context = new Map(input.context.map((item) => [item.citationId, item]));
  const conflictSidesByQuery = new Map<string, Map<string, Set<string>>>();
  for (const item of input.context) {
    const group = item.metadata.conflictGroup;
    const side = item.metadata.conflictSide;
    if (typeof group !== "string" || typeof side !== "string") continue;
    const groups = conflictSidesByQuery.get(item.queryUnitId) ?? new Map<string, Set<string>>();
    const sides = groups.get(group) ?? new Set<string>();
    sides.add(side);
    groups.set(group, sides);
    conflictSidesByQuery.set(item.queryUnitId, groups);
  }
  const seenKeys = new Set<string>();
  return input.claims.map((claim): ClaimValidation => {
    let reason: string | undefined;
    const cited = claim.citationIds.map((id) => context.get(id));
    if (seenKeys.has(claim.key) || !queryIds.has(claim.queryUnitId)) reason = "Claim key or query unit is invalid";
    else if (cited.some((item) => !item || item.queryUnitId !== claim.queryUnitId)) reason = "Claim cites context not supplied for its query unit";
    else if (claim.kind === "legal" && cited.every((item) => item?.channel !== "legal")) reason = "Legal claim lacks legal authority";
    else if (claim.kind === "organization" && cited.every((item) => item?.channel === "legal")) reason = "Organization claim lacks organization evidence";
    else if (claim.binding && cited.filter((item) => item?.channel === "legal").every((item) => item?.authorityTier === "curated_secondary" || item?.translationStatus !== "official")) reason = "Binding claim relies only on secondary or non-official material";
    const hasConflict = [...(conflictSidesByQuery.get(claim.queryUnitId)?.values() ?? [])]
      .some((sides) => sides.size > 1);
    seenKeys.add(claim.key);
    return {
      ...claim,
      claimTextHash: createHash("sha256").update(claim.text).digest("hex"),
      validation: reason ? "unsupported" : hasConflict ? "conflicting" : "supported",
      safeFailureReason: reason ?? (hasConflict ? "Conflicting sources require review" : undefined),
    };
  });
}

export function hasCompleteQueryUnitCoverage(
  queryUnits: QueryUnit[],
  claims: Pick<GroundedClaim, "queryUnitId">[],
) {
  const counts = new Map<string, number>();
  for (const claim of claims) counts.set(claim.queryUnitId, (counts.get(claim.queryUnitId) ?? 0) + 1);
  return queryUnits.every((unit) => counts.get(unit.id) === 1)
    && [...counts.keys()].every((id) => queryUnits.some((unit) => unit.id === id));
}
