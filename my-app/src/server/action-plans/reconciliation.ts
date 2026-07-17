export type ReconciliationFinding = {
  findingId: string;
  stableRequirementId: string;
  requirementVersionId: string;
  status: "fulfilled" | "partially_fulfilled" | "not_fulfilled" | "insufficient_evidence";
};

export type ReconciliationPlanItem = {
  itemId: string;
  findingId: string;
  stableRequirementId: string;
  requirementVersionId: string;
  status: "open" | "in_progress" | "done" | "cancelled";
};

export type ReconciliationChangeKind =
  | "unchanged_gap"
  | "new_gap"
  | "proposed_closure"
  | "effectiveness_not_confirmed"
  | "requirement_version_changed"
  | "requirement_removed";

export type ReconciliationDecision =
  | "carry_over"
  | "close"
  | "reopen"
  | "create_follow_up"
  | "keep_legacy"
  | "cancel";

export type ReconciliationItemProposal = {
  stableRequirementId: string;
  previousItemId: string | null;
  previousFindingId: string | null;
  targetFindingId: string | null;
  changeKind: ReconciliationChangeKind;
  proposedDecision: ReconciliationDecision;
  allowedDecisions: ReconciliationDecision[];
  requiresDecision: boolean;
  carryOperationalFields: boolean;
};

export function reconcileActionPlanItems(input: {
  previousItems: ReconciliationPlanItem[];
  targetFindings: ReconciliationFinding[];
}): ReconciliationItemProposal[] {
  const previousByRequirement = uniqueByStableRequirement(
    input.previousItems,
    "previous plan item",
  );
  const targetByRequirement = uniqueByStableRequirement(
    input.targetFindings,
    "target finding",
  );
  const stableRequirementIds = new Set([
    ...previousByRequirement.keys(),
    ...targetByRequirement.keys(),
  ]);
  const proposals: ReconciliationItemProposal[] = [];

  for (const stableRequirementId of stableRequirementIds) {
    const previous = previousByRequirement.get(stableRequirementId);
    const target = targetByRequirement.get(stableRequirementId);
    if (!previous && target?.status === "fulfilled") continue;
    if (!previous && target) {
      proposals.push(proposal({
        stableRequirementId,
        target,
        changeKind: "new_gap",
        proposedDecision: "create_follow_up",
        allowedDecisions: ["create_follow_up"],
        requiresDecision: false,
        carryOperationalFields: false,
      }));
      continue;
    }
    if (previous && !target) {
      proposals.push(proposal({
        stableRequirementId,
        previous,
        changeKind: "requirement_removed",
        proposedDecision: "keep_legacy",
        allowedDecisions: ["keep_legacy", "close", "cancel"],
        requiresDecision: true,
        carryOperationalFields: true,
      }));
      continue;
    }
    if (!previous || !target) continue;
    if (previous.requirementVersionId !== target.requirementVersionId) {
      proposals.push(proposal({
        stableRequirementId,
        previous,
        target,
        changeKind: "requirement_version_changed",
        proposedDecision: target.status === "fulfilled" ? "close" : "carry_over",
        allowedDecisions:
          target.status === "fulfilled"
            ? ["close", "keep_legacy"]
            : ["carry_over", "create_follow_up", "cancel"],
        requiresDecision: true,
        carryOperationalFields: true,
      }));
      continue;
    }
    if (target.status === "fulfilled") {
      proposals.push(proposal({
        stableRequirementId,
        previous,
        target,
        changeKind: "proposed_closure",
        proposedDecision: "close",
        allowedDecisions: ["close", "keep_legacy"],
        requiresDecision: true,
        carryOperationalFields: true,
      }));
      continue;
    }
    if (previous.status === "done" || previous.status === "cancelled") {
      proposals.push(proposal({
        stableRequirementId,
        previous,
        target,
        changeKind: "effectiveness_not_confirmed",
        proposedDecision:
          previous.status === "done" ? "reopen" : "create_follow_up",
        allowedDecisions:
          previous.status === "done"
            ? ["reopen", "create_follow_up"]
            : ["create_follow_up"],
        requiresDecision: true,
        carryOperationalFields: previous.status === "done",
      }));
      continue;
    }
    proposals.push(proposal({
      stableRequirementId,
      previous,
      target,
      changeKind: "unchanged_gap",
      proposedDecision: "carry_over",
      allowedDecisions: ["carry_over"],
      requiresDecision: false,
      carryOperationalFields: true,
    }));
  }

  return proposals;
}

export function requiresReconciliationDecision(changeKind: ReconciliationChangeKind) {
  return !["unchanged_gap", "new_gap"].includes(changeKind);
}

export function allowedReconciliationDecisions(input: {
  changeKind: ReconciliationChangeKind;
  proposedDecision: ReconciliationDecision;
}): ReconciliationDecision[] {
  switch (input.changeKind) {
    case "unchanged_gap":
      return ["carry_over"];
    case "new_gap":
      return ["create_follow_up"];
    case "proposed_closure":
      return ["close", "keep_legacy"];
    case "effectiveness_not_confirmed":
      return input.proposedDecision === "reopen"
        ? ["reopen", "create_follow_up"]
        : ["create_follow_up"];
    case "requirement_version_changed":
      return input.proposedDecision === "close"
        ? ["close", "keep_legacy"]
        : ["carry_over", "create_follow_up", "cancel"];
    case "requirement_removed":
      return ["keep_legacy", "close", "cancel"];
  }
}

function proposal(input: {
  stableRequirementId: string;
  previous?: ReconciliationPlanItem;
  target?: ReconciliationFinding;
  changeKind: ReconciliationChangeKind;
  proposedDecision: ReconciliationDecision;
  allowedDecisions: ReconciliationDecision[];
  requiresDecision: boolean;
  carryOperationalFields: boolean;
}): ReconciliationItemProposal {
  return {
    stableRequirementId: input.stableRequirementId,
    previousItemId: input.previous?.itemId ?? null,
    previousFindingId: input.previous?.findingId ?? null,
    targetFindingId: input.target?.findingId ?? null,
    changeKind: input.changeKind,
    proposedDecision: input.proposedDecision,
    allowedDecisions: input.allowedDecisions,
    requiresDecision: input.requiresDecision,
    carryOperationalFields: input.carryOperationalFields,
  };
}

function uniqueByStableRequirement<T extends { stableRequirementId: string }>(
  values: T[],
  label: string,
) {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.stableRequirementId)) {
      throw new Error(`Duplicate ${label} for ${value.stableRequirementId}`);
    }
    result.set(value.stableRequirementId, value);
  }
  return result;
}
