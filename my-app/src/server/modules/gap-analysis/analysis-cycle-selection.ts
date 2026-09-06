export type AnalysisCycleEvidenceCandidate = {
  versionId: string;
  documentId: string;
  currentVersionId: string | null;
  active: boolean;
  indexed: boolean;
};

export type AnalysisCycleEvidenceSelection = {
  versionId: string;
  documentId: string;
  origin: "approved_carryover" | "version_replacement" | "explicit_addition";
};

export function buildAnalysisCycleEvidenceSelection(input: {
  accepted: Array<{ versionId: string; documentId: string }>;
  candidates: AnalysisCycleEvidenceCandidate[];
  explicitAdditions: string[];
}) {
  const candidateByVersion = new Map(
    input.candidates.map((candidate) => [candidate.versionId, candidate]),
  );
  const currentByDocument = new Map(
    input.candidates
      .filter(
        (candidate) =>
          candidate.currentVersionId === candidate.versionId &&
          candidate.active &&
          candidate.indexed,
      )
      .map((candidate) => [candidate.documentId, candidate]),
  );
  const acceptedByDocument = new Map(
    input.accepted.map((accepted) => [accepted.documentId, accepted]),
  );
  const selection = new Map<string, AnalysisCycleEvidenceSelection>();
  const blocked: string[] = [];

  for (const versionId of new Set(input.explicitAdditions)) {
    const requested = candidateByVersion.get(versionId);
    const current = requested
      ? currentByDocument.get(requested.documentId)
      : undefined;
    if (!requested || !current) {
      blocked.push(versionId);
      continue;
    }
    if (!selection.has(current.documentId)) {
      const accepted = acceptedByDocument.get(current.documentId);
      selection.set(current.documentId, {
        versionId: current.versionId,
        documentId: current.documentId,
        origin:
          accepted?.versionId === current.versionId
            ? "approved_carryover"
            : accepted
              ? "version_replacement"
              : "explicit_addition",
      });
    }
  }

  const selectedDocuments = new Set(selection.keys());
  return {
    selection: [...selection.values()],
    removed: input.accepted
      .filter((accepted) => !selectedDocuments.has(accepted.documentId))
      .map((accepted) => accepted.versionId),
    blocked: [...new Set(blocked)],
  };
}
