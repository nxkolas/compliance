import { describe, expect, it } from "vitest";
import { reports } from "@/src/db/schema";
import {
  assertPendingReportFinalization,
  hashReportRenderSnapshot,
  type ReportRenderSnapshot,
} from "@/src/server/reports/render-snapshot";

describe("authoritative report render snapshots", () => {
  it("keeps the input hash null while a report is pending", () => {
    expect(reports.inputHash.notNull).toBe(false);
  });

  it("allows a report to omit the Gap revision", () => {
    expect(reports.gapRevisionId.notNull).toBe(false);
  });

  it("hashes exact content and mutable Action Plan item status canonically", () => {
    const open = snapshot("open");
    const done = snapshot("done");
    expect(hashReportRenderSnapshot(open)).not.toBe(
      hashReportRenderSnapshot(done),
    );
    expect(hashReportRenderSnapshot(open)).toBe(
      hashReportRenderSnapshot({
        content: open.content,
        documentVersionIds: open.documentVersionIds,
        actionPlanId: open.actionPlanId,
        gapRevisionId: open.gapRevisionId,
        applicabilityRevisionId: open.applicabilityRevisionId,
        capturedAt: open.capturedAt,
        locale: open.locale,
      }),
    );
  });

  it("allows one atomic finalization and rejects completed or partial metadata", () => {
    expect(() =>
      assertPendingReportFinalization({
        inputHash: null,
        pdfBucket: null,
        pdfKey: null,
        pdfHash: null,
        pdfByteSize: null,
      }),
    ).not.toThrow();
    expect(() =>
      assertPendingReportFinalization({
        inputHash: "a".repeat(64),
        pdfBucket: "reports",
        pdfKey: "report.pdf",
        pdfHash: "b".repeat(64),
        pdfByteSize: 100,
      }),
    ).toThrow(/completed/);
    expect(() =>
      assertPendingReportFinalization({
        inputHash: null,
        pdfBucket: "reports",
        pdfKey: null,
        pdfHash: null,
        pdfByteSize: null,
      }),
    ).toThrow(/partial/);
  });
});

function snapshot(status: "open" | "done"): ReportRenderSnapshot {
  return {
    capturedAt: "2026-08-02T12:00:00.000Z",
    locale: "en",
    applicabilityRevisionId: "applicability",
    gapRevisionId: "gap",
    actionPlanId: "plan",
    documentVersionIds: ["document-1"],
    content: {
      organization: { name: "Example Energy", legalName: "Example Energy Ltd" },
      applicability: {
        outcome: "Covered",
        outcomeCode: "important_entity",
        jurisdiction: "DE",
        answers: [{ question: "Question", answer: "Answer" }],
      },
      gap: {
        openGapItemCount: 1,
        statusCounts: {
          not_fulfilled: 1,
          partially_fulfilled: 0,
          insufficient_evidence: 0,
          fulfilled: 0,
        },
        findings: [{
          title: "Governance",
          status: "not_fulfilled",
          hasOrganizationDocument: false,
          reviewNotice: null,
          gaps: ["An owner is missing."],
          legalReferences: [{ instrument: "German BSI Act", provision: "Section 38(1)" }],
        }],
      },
      actions: {
        statusCounts: {
          open: status === "open" ? 1 : 0,
          in_progress: 0,
          done: status === "done" ? 1 : 0,
          cancelled: 0,
        },
        groups: [{
          findingTitle: "Governance",
          items: [{
            title: "Assign owner",
            result: "Assign one.",
            suggestedEvidence: [],
            status,
          }],
        }],
      },
      sourceRegister: [{
        title: "German BSI Act",
        reference: "German BSI Act, Section 38(1)",
        location: "p. 29",
      }],
    },
  };
}
