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
      applicability: {
        outcome: "Covered",
        jurisdiction: "DE",
        answers: [{ question: "Question", answer: "Answer" }],
      },
      findings: [{
        title: "Governance",
        status: "Not fulfilled",
        summary: "Stored summary",
        hasOrganizationDocument: false,
        reviewNotice: null,
        gaps: ["An owner is missing."],
        sources: [],
      }],
      actions: [{ title: "Assign owner", description: "Assign one.", status }],
    },
  };
}
