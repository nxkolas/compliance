export function classifyFindingCitationLinks(input: {
  citationIds: string[];
  contextIdByCitation: ReadonlyMap<string, string>;
  conflictingOrganizationCitationIds: string[];
}) {
  const conflicts = new Set(input.conflictingOrganizationCitationIds);
  return [...new Set(input.citationIds)].flatMap((citationId) => {
    const contextId = input.contextIdByCitation.get(citationId);
    return contextId
      ? [{
          citationId,
          contextId,
          relationship: conflicts.has(citationId)
            ? "conflicting" as const
            : "supporting" as const,
        }]
      : [];
  });
}

export function resolvedFindingLinkDisposition(input: {
  currentDisposition: "admitted" | "rejected";
  relationship: "supporting" | "conflicting";
  sourceChoice: "questionnaire" | "document";
  isTargetFinding: boolean;
  isExactConflictingContext: boolean;
}) {
  return input.isTargetFinding &&
    input.relationship === "conflicting" &&
    input.sourceChoice === "questionnaire" &&
    input.isExactConflictingContext
    ? "rejected" as const
    : input.currentDisposition;
}
