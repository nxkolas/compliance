import { describe, expect, it } from "vitest";
import {
  applyWelcomeCompletion,
  deriveOrganizationProgress,
  type OrganizationProgressSignals,
} from "@/src/organization-progress/model";

const initialSignals: OrganizationProgressSignals = {
  hasAcceptedApplicability: false,
  applicabilityOutcome: null,
  hasAcceptedGapAnalysis: false,
  hasUploadedDocument: false,
  hasActivatedActionPlan: false,
  activeActionPlanItemStatuses: null,
};

describe("organization progress derivation", () => {
  it("starts with every step incomplete", () => {
    const progress = deriveOrganizationProgress(initialSignals);

    expect(progress).toEqual({
      completedCount: 0,
      totalCount: 6,
      steps: [
        { key: "welcome", completed: false },
        { key: "applicability_check", completed: false },
        { key: "gap_analysis", completed: false },
        { key: "documents_uploaded", completed: false },
        { key: "action_plan", completed: false },
        { key: "next_steps", completed: false },
      ],
    });
  });

  it("exposes completed steps even when an earlier step is still incomplete", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "important_entity",
      hasActivatedActionPlan: true,
    });

    expect(progress.completedCount).toBe(3);
    expect(progress.steps).toEqual([
      { key: "welcome", completed: true },
      { key: "applicability_check", completed: true },
      { key: "gap_analysis", completed: false },
      { key: "documents_uploaded", completed: false },
      { key: "action_plan", completed: true },
      { key: "next_steps", completed: false },
    ]);
  });

  it("keeps next steps incomplete while an active plan has open work", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "essential_entity",
      hasAcceptedGapAnalysis: true,
      hasUploadedDocument: true,
      hasActivatedActionPlan: true,
      activeActionPlanItemStatuses: ["done", "in_progress"],
    });

    expect(progress.completedCount).toBe(5);
    expect(progress.steps[5]).toEqual({
      key: "next_steps",
      completed: false,
    });
  });

  it("completes next steps when every active-plan item is terminal", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "clarification_required",
      hasAcceptedGapAnalysis: true,
      hasUploadedDocument: true,
      hasActivatedActionPlan: true,
      activeActionPlanItemStatuses: ["done", "done"],
    });

    expect(progress.completedCount).toBe(6);
    expect(progress.steps.every((step) => step.completed)).toBe(true);
  });

  it("treats an empty active plan as complete", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "important_entity",
      hasAcceptedGapAnalysis: true,
      hasUploadedDocument: true,
      hasActivatedActionPlan: true,
      activeActionPlanItemStatuses: [],
    });
    expect(progress.completedCount).toBe(6);
  });

  it("ends an out-of-scope journey after applicability", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "not_directly_in_scope",
    });

    expect(progress).toEqual({
      completedCount: 2,
      totalCount: 2,
      steps: [
        { key: "welcome", completed: true },
        { key: "applicability_check", completed: true },
        { key: "gap_analysis", completed: false },
        { key: "documents_uploaded", completed: false },
        { key: "action_plan", completed: false },
        { key: "next_steps", completed: false },
      ],
    });
  });
});

describe("local welcome completion", () => {
  it("completes welcome locally without mutation", () => {
    const serverProgress = deriveOrganizationProgress(initialSignals);
    const snapshot = structuredClone(serverProgress);

    const localProgress = applyWelcomeCompletion(serverProgress, true);

    expect(serverProgress).toEqual(snapshot);
    expect(localProgress).toMatchObject({
      completedCount: 1,
      totalCount: 6,
    });
    expect(localProgress.steps.slice(0, 2)).toEqual([
      { key: "welcome", completed: true },
      { key: "applicability_check", completed: false },
    ]);
  });

  it("returns the authoritative progress when no local completion is applied", () => {
    const serverProgress = deriveOrganizationProgress(initialSignals);

    expect(applyWelcomeCompletion(serverProgress, false)).toBe(serverProgress);
  });
});
