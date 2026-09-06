import { contentHash } from "@/src/server/modules/compliance";
import type { LegalCitation } from "@/src/server/modules/compliance";
import type { GapStatus } from "@/src/server/modules/gap-analysis";

export type ReportActionStatus = "open" | "in_progress" | "done" | "cancelled";

export type ReportContentSnapshot = {
  organization: {
    name: string;
    legalName: string | null;
  };
  applicability: {
    outcome: string;
    outcomeCode: string | null;
    jurisdiction: string | null;
    answers: Array<{ question: string; answer: string }>;
  };
  gap: {
    /** gap_items belonging to a finding that is not `fulfilled`. */
    openGapItemCount: number;
    /** Findings per status, counted exactly like the Gap-Analyse UI. */
    statusCounts: Record<GapStatus, number>;
    findings: Array<{
      title: string;
      status: GapStatus;
      hasOrganizationDocument: boolean;
      reviewNotice: string | null;
      gaps: string[];
      legalReferences: LegalCitation[];
    }>;
  } | null;
  actions: {
    statusCounts: Record<ReportActionStatus, number>;
    groups: Array<{
      findingTitle: string;
      items: Array<{
        title: string;
        result: string;
        suggestedEvidence: string[];
        status: ReportActionStatus;
      }>;
    }>;
  };
  /** Compact provenance for the appendix: no excerpts, no identifiers. */
  sourceRegister: Array<{
    title: string;
    reference: string | null;
    location: string | null;
  }>;
};

export type ReportRenderSnapshot = {
  capturedAt: string;
  locale: "de" | "en";
  applicabilityRevisionId: string;
  gapRevisionId: string | null;
  actionPlanId: string | null;
  documentVersionIds: string[];
  content: ReportContentSnapshot;
};

export function hashReportRenderSnapshot(snapshot: ReportRenderSnapshot) {
  return contentHash(snapshot);
}

export function assertPendingReportFinalization(report: {
  inputHash: string | null;
  pdfBucket: string | null;
  pdfKey: string | null;
  pdfHash: string | null;
  pdfByteSize: number | null;
}) {
  const values = [
    report.inputHash,
    report.pdfBucket,
    report.pdfKey,
    report.pdfHash,
    report.pdfByteSize,
  ];
  const present = values.filter((value) => value !== null).length;
  if (present === values.length) {
    throw new Error("The report is completed and immutable");
  }
  if (present !== 0) {
    throw new Error("The report has invalid partial finalization metadata");
  }
}
