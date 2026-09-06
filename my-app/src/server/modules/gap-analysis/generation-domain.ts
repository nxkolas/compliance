export type GapFindingStatus =
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "insufficient_evidence";

export type SuppliedCitation = {
  id: string;
  sourceType:
    | "assessment_answer"
    | "document_chunk"
    | "legal_source_chunk";
  sourceId: string;
  excerpt: string;
  pageNumber: number | null;
  sectionLabel: string | null;
};

export function deriveFindingSeverity(
  criticality: "low" | "medium" | "high" | "critical",
  status: GapFindingStatus,
) {
  if (status === "fulfilled") return "low" as const;
  if (status === "insufficient_evidence") {
    return criticality === "critical" ? "high" : criticality;
  }
  if (status === "partially_fulfilled") {
    if (criticality === "critical") return "high" as const;
    if (criticality === "high") return "medium" as const;
  }
  return criticality;
}
