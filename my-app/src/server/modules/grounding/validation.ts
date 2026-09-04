import { createHash } from "node:crypto";
import type { GroundedClaim, GroundingContextItem, QueryUnit } from "./types";

export type ClaimValidation = GroundedClaim & {
  validation:
    "supported" | "unsupported" | "conflicting" | "insufficient_information";
  safeFailureReason?: string;
  claimTextHash: string;
};

const safeFailureReasons = new Set([
  "Claim key or query unit is invalid",
  "Claim cites context not supplied for its query unit",
  "Legal claim lacks legal authority",
  "Organization claim lacks organization evidence",
  "Binding claim relies only on secondary or non-official material",
  "Conflicting sources require review",
  "Grounding validation failed",
]);

export type GroundingFailureDiagnostic = {
  claims: Array<{
    key: string;
    reason: string;
  }>;
};

export function toGroundingFailureDiagnostic(
  claims: ClaimValidation[],
): GroundingFailureDiagnostic {
  return {
    claims: claims.map((claim) => ({
      key: safeClaimKey(claim.key),
      reason: safeFailureReasons.has(claim.safeFailureReason ?? "")
        ? claim.safeFailureReason!
        : "Grounding validation failed",
    })),
  };
}

export function safeGroundingFailureMessage(error: unknown) {
  const generic = "Grounded operation failed.";
  if (!isRecord(error) || error.code !== "GROUNDING_VALIDATION_FAILED") {
    return generic;
  }
  const details = error.details;
  if (!isRecord(details) || !Array.isArray(details.claims)) return generic;
  const claims = details.claims.flatMap((claim) => {
    if (
      !isRecord(claim) ||
      typeof claim.key !== "string" ||
      typeof claim.reason !== "string" ||
      !safeFailureReasons.has(claim.reason)
    ) {
      return [];
    }
    return [
      {
        key: safeClaimKey(claim.key),
        reason: claim.reason,
      },
    ];
  });
  if (claims.length !== details.claims.length || claims.length === 0) {
    return generic;
  }
  return JSON.stringify({
    code: "GROUNDING_VALIDATION_FAILED",
    claims,
  });
}

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
    const groups =
      conflictSidesByQuery.get(item.queryUnitId) ??
      new Map<string, Set<string>>();
    const sides = groups.get(group) ?? new Set<string>();
    sides.add(side);
    groups.set(group, sides);
    conflictSidesByQuery.set(item.queryUnitId, groups);
  }
  const seenKeys = new Set<string>();
  return input.claims.map((claim): ClaimValidation => {
    let reason: string | undefined;
    const cited = claim.citationIds.map((id) => context.get(id));
    if (seenKeys.has(claim.key) || !queryIds.has(claim.queryUnitId))
      reason = "Claim key or query unit is invalid";
    else if (
      cited.some((item) => !item || item.queryUnitId !== claim.queryUnitId)
    )
      reason = "Claim cites context not supplied for its query unit";
    else if (
      claim.kind === "legal" &&
      cited.every((item) => item?.channel !== "legal")
    )
      reason = "Legal claim lacks legal authority";
    else if (
      claim.kind === "organization" &&
      cited.every((item) => item?.channel === "legal")
    )
      reason = "Organization claim lacks organization evidence";
    else if (
      claim.binding &&
      cited
        .filter((item) => item?.channel === "legal")
        .every(
          (item) =>
            item?.authorityTier === "curated_secondary" ||
            item?.translationStatus !== "official",
        )
    )
      reason =
        "Binding claim relies only on secondary or non-official material";
    const hasConflict = [
      ...(conflictSidesByQuery.get(claim.queryUnitId)?.values() ?? []),
    ].some((sides) => sides.size > 1);
    seenKeys.add(claim.key);
    return {
      ...claim,
      claimTextHash: createHash("sha256").update(claim.text).digest("hex"),
      validation: reason
        ? "unsupported"
        : hasConflict
          ? "conflicting"
          : "supported",
      safeFailureReason:
        reason ??
        (hasConflict ? "Conflicting sources require review" : undefined),
    };
  });
}

function safeClaimKey(value: string) {
  return /^[A-Za-z0-9_.:/-]{1,200}$/.test(value) ? value : "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hasCompleteQueryUnitCoverage(
  queryUnits: QueryUnit[],
  claims: Pick<GroundedClaim, "queryUnitId">[],
) {
  const counts = new Map<string, number>();
  for (const claim of claims)
    counts.set(claim.queryUnitId, (counts.get(claim.queryUnitId) ?? 0) + 1);
  return (
    queryUnits.every((unit) => (counts.get(unit.id) ?? 0) >= 1) &&
    [...counts.keys()].every((id) => queryUnits.some((unit) => unit.id === id))
  );
}
