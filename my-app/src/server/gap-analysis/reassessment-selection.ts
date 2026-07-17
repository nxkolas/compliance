export type ReassessmentEvidenceCandidate = {
  versionId: string;
  documentId: string;
  currentVersionId: string | null;
  active: boolean;
  indexed: boolean;
};

export type ReassessmentEvidenceSelection = {
  versionId: string;
  documentId: string;
  origin: "approved_carryover" | "version_replacement" | "explicit_addition";
};

export function buildReassessmentEvidenceSelection(input: {
  accepted: Array<{ versionId: string; documentId: string }>;
  candidates: ReassessmentEvidenceCandidate[];
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
  const selection = new Map<string, ReassessmentEvidenceSelection>();
  const removed: string[] = [];
  const blocked: string[] = [];

  for (const accepted of input.accepted) {
    const current = currentByDocument.get(accepted.documentId);
    const acceptedCandidate = candidateByVersion.get(accepted.versionId);
    if (!current) {
      if (acceptedCandidate && !acceptedCandidate.active) {
        removed.push(accepted.versionId);
      } else {
        blocked.push(accepted.versionId);
      }
      continue;
    }
    selection.set(current.versionId, {
      versionId: current.versionId,
      documentId: current.documentId,
      origin:
        current.versionId === accepted.versionId
          ? "approved_carryover"
          : "version_replacement",
    });
  }

  for (const versionId of new Set(input.explicitAdditions)) {
    const candidate = candidateByVersion.get(versionId);
    if (
      !candidate ||
      !candidate.active ||
      !candidate.indexed ||
      candidate.currentVersionId !== candidate.versionId
    ) {
      blocked.push(versionId);
      continue;
    }
    if (!selection.has(versionId)) {
      selection.set(versionId, {
        versionId,
        documentId: candidate.documentId,
        origin: "explicit_addition",
      });
    }
  }

  return {
    selection: [...selection.values()],
    removed: [...new Set(removed)],
    blocked: [...new Set(blocked)],
  };
}
