import { describe, expect, it } from "vitest";
import {
  compareGapFindings,
  countGapStatuses,
  deriveGapLifecycleCapabilities,
  deriveGapLifecycleMode,
  deriveGapWorkflowNavigation,
  resolveGapPostGenerationView,
  selectGapWorkflowRevisions,
  sortGapFindings,
} from "@/src/server/gap-analysis/workflow-state";

describe("single gap lifecycle", () => {
  it.each([
    [{ hasGeneratedRevision: false, hasActiveActionPlan: false, generationActive: false }, "collecting_inputs"],
    [{ hasGeneratedRevision: false, hasActiveActionPlan: false, generationActive: true }, "generating"],
    [{ hasGeneratedRevision: true, hasActiveActionPlan: false, generationActive: false }, "generated_editable"],
    [{ hasGeneratedRevision: true, hasActiveActionPlan: true, generationActive: false }, "locked_by_action_plan"],
  ] as const)("derives the authoritative mode", (input, expected) => {
    expect(deriveGapLifecycleMode(input)).toBe(expected);
  });

  it("allows corrections and finalization only before the action plan exists", () => {
    expect(deriveGapLifecycleCapabilities("generated_editable")).toMatchObject({
      showGeneratedViews: true,
      findingsEditable: true,
      canFinalize: true,
      locked: false,
    });
    expect(deriveGapLifecycleCapabilities("locked_by_action_plan")).toMatchObject({
      showGeneratedViews: true,
      findingsEditable: false,
      canFinalize: false,
      locked: true,
    });
  });

  it("defaults generated navigation to results", () => {
    expect(resolveGapPostGenerationView()).toBe("results");
    expect(resolveGapPostGenerationView("unknown")).toBe("results");
    expect(resolveGapPostGenerationView("inputs")).toBe("inputs");
    expect(resolveGapPostGenerationView("history")).toBe("history");
  });
});

describe("selectGapWorkflowRevisions", () => {
  it("keeps the accepted revision authoritative while a newer candidate is current", () => {
    const result = selectGapWorkflowRevisions({
      accepted: { id: "approved-a", status: "approved" },
      current: { id: "candidate-b", status: "generated" },
    });
    expect(result.accepted?.id).toBe("approved-a");
    expect(result.candidate?.id).toBe("candidate-b");
  });

  it("does not duplicate the accepted revision as a candidate", () => {
    const accepted = { id: "approved-a" };
    expect(
      selectGapWorkflowRevisions({ accepted, current: accepted }),
    ).toEqual({ accepted, candidate: null });
  });
});

describe("guided gap workflow navigation", () => {
  it("keeps the legacy step resolver scoped to pre-generation navigation", () => {
    expect(
      deriveGapWorkflowNavigation({
        prerequisiteSatisfied: true,
        hasAssessment: true,
        answeredQuestionCount: 4,
        requiredQuestionCount: 4,
        hasPreparedInputs: true,
        hasResult: true,
        requestedStep: "documents",
      }),
    ).toMatchObject({
      defaultStep: "gaps",
      activeStep: "documents",
      allowedSteps: ["questions", "documents", "review", "gaps"],
    });
  });

  it("does not let a direct URL skip required questions", () => {
    expect(
      deriveGapWorkflowNavigation({
        prerequisiteSatisfied: true,
        hasAssessment: true,
        answeredQuestionCount: 1,
        requiredQuestionCount: 4,
        hasPreparedInputs: false,
        hasResult: false,
        requestedStep: "review",
      }).activeStep,
    ).toBe("questions");
  });

  it.each(["questions", "documents", "review", "gaps"])(
    "reveals no workflow step for a blocked prerequisite at %s",
    (requestedStep) => {
      expect(
        deriveGapWorkflowNavigation({
          prerequisiteSatisfied: false,
          hasAssessment: true,
          answeredQuestionCount: 4,
          requiredQuestionCount: 4,
          hasPreparedInputs: true,
          hasResult: true,
          requestedStep,
        }),
      ).toMatchObject({
        activeStep: "questions",
        allowedSteps: [],
      });
    },
  );
});

describe("gap result presentation", () => {
  const row = (
    id: string,
    status: "fulfilled" | "partially_fulfilled" | "not_fulfilled" | "insufficient_evidence",
    position: number,
  ) => ({
    finding: { status },
    requirement: {
      stableRequirementId: id,
      title: id,
      position,
      icon: "KeyRound",
    },
  });

  it("counts and orders gap statuses with catalogue order inside a group", () => {
    const findings = [
      row("fulfilled", "fulfilled", 1),
      row("partial-2", "partially_fulfilled", 20),
      row("not", "not_fulfilled", 30),
      row("partial-1", "partially_fulfilled", 10),
    ];
    expect(countGapStatuses(findings)).toMatchObject({
      all: 4,
      fulfilled: 1,
      partially_fulfilled: 2,
      not_fulfilled: 1,
    });
    expect(
      sortGapFindings(findings).map(
        (finding) => finding.requirement.stableRequirementId,
      ),
    ).toEqual(["fulfilled", "partial-1", "partial-2", "not"]);
  });

  it("compares results by stable requirement identity", () => {
    expect(
      compareGapFindings(
        [row("access", "not_fulfilled", 1)],
        [row("access", "partially_fulfilled", 1)],
      )[0],
    ).toMatchObject({
      stableRequirementId: "access",
      previousStatus: "not_fulfilled",
      currentStatus: "partially_fulfilled",
      changed: true,
    });
  });
});
