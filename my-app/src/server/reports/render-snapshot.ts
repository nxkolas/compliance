import { contentHash } from "@/src/server/compliance";

export type ReportContentSnapshot = {
  applicability: {
    outcome: string;
    jurisdiction: string | null;
    answers: Array<{ question: string; answer: string }>;
  };
  findings: Array<{
    title: string;
    status: string;
    summary: string;
    hasOrganizationDocument: boolean;
    reviewNotice: string | null;
    gaps: string[];
    sources: string[];
  }>;
  actions: Array<{
    title: string;
    description: string;
    status: string;
  }>;
};

export type ReportRenderSnapshot = {
  capturedAt: string;
  locale: "de" | "en";
  applicabilityRevisionId: string;
  gapRevisionId: string;
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
