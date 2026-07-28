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
  it("starts with welcome as the current step", () => {
    const progress = deriveOrganizationProgress(initialSignals);

    expect(progress).toEqual({
      currentStep: "welcome",
      completedCount: 0,
      totalCount: 6,
      steps: [
        { key: "welcome", status: "current" },
        { key: "applicability_check", status: "upcoming" },
        { key: "gap_analysis", status: "upcoming" },
        { key: "documents_uploaded", status: "upcoming" },
        { key: "action_plan", status: "upcoming" },
        { key: "next_steps", status: "upcoming" },
      ],
    });
  });

  it("does not expose out-of-order completion", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "important_entity",
      hasUploadedDocument: true,
      hasActivatedActionPlan: true,
      activeActionPlanItemStatuses: ["done"],
    });

    expect(progress.completedCount).toBe(2);
    expect(progress.currentStep).toBe("gap_analysis");
    expect(progress.steps).toEqual([
      { key: "welcome", status: "completed" },
      { key: "applicability_check", status: "completed" },
      { key: "gap_analysis", status: "current" },
      { key: "documents_uploaded", status: "upcoming" },
      { key: "action_plan", status: "upcoming" },
      { key: "next_steps", status: "upcoming" },
    ]);
  });

  it("keeps next steps current while an active plan has open work", () => {
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
    expect(progress.currentStep).toBe("next_steps");
    expect(progress.steps[5]).toEqual({
      key: "next_steps",
      status: "current",
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
      activeActionPlanItemStatuses: ["done", "cancelled"],
    });

    expect(progress.completedCount).toBe(6);
    expect(progress.currentStep).toBeNull();
    expect(progress.steps.every((step) => step.status === "completed")).toBe(
      true,
    );
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

    expect(progress.currentStep).toBeNull();
    expect(progress.completedCount).toBe(6);
  });

  it("ends an out-of-scope journey after applicability", () => {
    const progress = deriveOrganizationProgress({
      ...initialSignals,
      hasAcceptedApplicability: true,
      applicabilityOutcome: "not_directly_in_scope",
    });

    expect(progress).toEqual({
      currentStep: null,
      completedCount: 2,
      totalCount: 2,
      steps: [
        { key: "welcome", status: "completed" },
        { key: "applicability_check", status: "completed" },
        { key: "gap_analysis", status: "not_applicable" },
        { key: "documents_uploaded", status: "not_applicable" },
        { key: "action_plan", status: "not_applicable" },
        { key: "next_steps", status: "not_applicable" },
      ],
    });
  });
});

describe("local welcome completion", () => {
  it("advances a fresh journey to the applicability check without mutation", () => {
    const serverProgress = deriveOrganizationProgress(initialSignals);
    const snapshot = structuredClone(serverProgress);

    const localProgress = applyWelcomeCompletion(serverProgress, true);

    expect(serverProgress).toEqual(snapshot);
    expect(localProgress).toMatchObject({
      currentStep: "applicability_check",
      completedCount: 1,
      totalCount: 6,
    });
    expect(localProgress.steps.slice(0, 2)).toEqual([
      { key: "welcome", status: "completed" },
      { key: "applicability_check", status: "current" },
    ]);
  });

  it("returns the authoritative progress when no local completion is applied", () => {
    const serverProgress = deriveOrganizationProgress(initialSignals);

    expect(applyWelcomeCompletion(serverProgress, false)).toBe(serverProgress);
  });
});
