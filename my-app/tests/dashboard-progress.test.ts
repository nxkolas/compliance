import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/modules/applicability-check", () => ({
  currentApplicabilityDefinitionHash: "app",
}));
vi.mock("@/src/server/modules/gap-analysis", () => ({
  currentGapDefinitionHash: "gap",
  getCurrentGapDefinition: () => ({ questions: [] }),
}));
vi.mock("@/src/server/platform/auth/organization-scope", () => ({
  authorizeOrganizationRead: vi.fn(),
}));

import { calculateDashboardProgress } from "@/src/server/modules/organizations/dashboard-progress";
import { buildDashboardProgressHistory } from "@/src/server/modules/organizations/dashboard-read-model";

const emptyStatuses = { open: 0, inProgress: 0, done: 0, cancelled: 0 };

describe("dashboard progress", () => {
  it("averages applicability, Gap answers, and weighted Action Plan work", () => {
    expect(calculateDashboardProgress({
      applicabilityAccepted: true,
      gapAccepted: false,
      gapAnswered: 15,
      gapTotal: 20,
      actionPlanExists: true,
      actionStatuses: { open: 17, inProgress: 11, done: 20, cancelled: 4 },
    })).toEqual({
      applicability: 100,
      gapAnalysis: 75,
      actionPlan: 53,
      percentage: 76,
    });
  });

  it("treats an accepted out-of-scope result as a completed workflow", () => {
    expect(calculateDashboardProgress({
      applicabilityAccepted: true,
      applicabilityOutcome: "not_directly_in_scope",
      gapAccepted: false,
      gapAnswered: 0,
      gapTotal: 20,
      actionPlanExists: false,
      actionStatuses: emptyStatuses,
    }).percentage).toBe(100);
  });

  it("replays monthly history and replaces the current bucket with authoritative state", () => {
    const history = buildDashboardProgressHistory({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-03-15T12:00:00.000Z"),
      now: new Date("2026-03-15T12:00:00.000Z"),
      current: { percentage: 75, applicability: 100, gapAnalysis: 100, actionPlan: 25 },
      events: [
        { id: "app", eventType: "applicability.submitted", entityId: "app", metadata: { outcome: "important_entity" }, occurredAt: new Date("2026-01-10T00:00:00.000Z") },
        { id: "answer", eventType: "gap_questionnaire.answer_saved", entityId: "cycle", metadata: { answeredRequired: 10, totalRequired: 20 }, occurredAt: new Date("2026-02-10T00:00:00.000Z") },
        { id: "gap", eventType: "gap.generated", entityId: "gap", metadata: {}, occurredAt: new Date("2026-03-01T00:00:00.000Z") },
      ],
    });

    expect(history.points.map((point) => point.percentage)).toEqual([0, 33, 50, 75]);
    expect(history.delta).toBe(25);
    expect(history.milestones.map((milestone) => milestone.code)).toEqual([
      "applicability_submitted",
      "gap_generated",
    ]);
  });
});
