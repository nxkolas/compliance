import {
  CHUNKING_VERSION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
} from "@/src/server/documents/domain";
import { ApiError } from "../../api/errors";

export const GAP_ORGANIZATION_EVIDENCE_POLICY = {
  version: "gap_org_evidence_relevance_v1",
  operation: "gap_analysis",
  provider: EMBEDDING_PROVIDER,
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  chunkingVersion: CHUNKING_VERSION,
  minimumSemanticScore: 0.55,
  minimumCombinedScore: 0.35,
  maximumAdmittedChunks: 3,
} as const;

export type OrganizationEvidenceCandidate = {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  content: string;
  pageNumber: number | null;
  sectionLabel: string | null;
  lexicalScore: number;
  semanticScore: number;
  combinedScore: number;
};

export type OrganizationEvidenceDecision = {
  chunkId: string;
  reason: "below_relevance_floor" | "result_limit";
  lexicalScore: number;
  semanticScore: number;
  combinedScore: number;
};

export function admitOrganizationEvidence(input: {
  operation: "gap_analysis";
  provider: string;
  model: string;
  dimensions: number;
  chunkingVersion: string;
  candidates: OrganizationEvidenceCandidate[];
}): {
  policyVersion: string;
  admitted: OrganizationEvidenceCandidate[];
  rejected: OrganizationEvidenceDecision[];
} {
  assertPolicyConfiguration(input);
  const candidates = [...input.candidates];
  for (const candidate of candidates) {
    if (
      !candidate.chunkId ||
      ![
        candidate.lexicalScore,
        candidate.semanticScore,
        candidate.combinedScore,
      ].every(Number.isFinite)
    ) {
      throw new ApiError(
        500,
        "Organization evidence scores are invalid",
        undefined,
        "GAP_ORG_EVIDENCE_SCORE_INVALID",
      );
    }
  }
  candidates.sort(compareCandidates);

  const admitted: OrganizationEvidenceCandidate[] = [];
  const rejected: OrganizationEvidenceDecision[] = [];
  for (const candidate of candidates) {
    const passesFloor =
      candidate.semanticScore >=
        GAP_ORGANIZATION_EVIDENCE_POLICY.minimumSemanticScore &&
      candidate.combinedScore >=
        GAP_ORGANIZATION_EVIDENCE_POLICY.minimumCombinedScore;
    if (!passesFloor) {
      rejected.push(toDecision(candidate, "below_relevance_floor"));
    } else if (
      admitted.length >=
      GAP_ORGANIZATION_EVIDENCE_POLICY.maximumAdmittedChunks
    ) {
      rejected.push(toDecision(candidate, "result_limit"));
    } else {
      admitted.push(candidate);
    }
  }
  return {
    policyVersion: GAP_ORGANIZATION_EVIDENCE_POLICY.version,
    admitted,
    rejected,
  };
}

function assertPolicyConfiguration(input: {
  operation: "gap_analysis";
  provider: string;
  model: string;
  dimensions: number;
  chunkingVersion: string;
}) {
  const policy = GAP_ORGANIZATION_EVIDENCE_POLICY;
  if (
    input.operation !== policy.operation ||
    input.provider !== policy.provider ||
    input.model !== policy.model ||
    input.dimensions !== policy.dimensions ||
    input.chunkingVersion !== policy.chunkingVersion
  ) {
    throw new ApiError(
      409,
      "Organization evidence policy does not match the indexed embedding space",
      {
        policyVersion: policy.version,
        expected: {
          operation: policy.operation,
          provider: policy.provider,
          model: policy.model,
          dimensions: policy.dimensions,
          chunkingVersion: policy.chunkingVersion,
        },
      },
      "GAP_ORG_EVIDENCE_POLICY_MISMATCH",
    );
  }
}

function compareCandidates(
  left: OrganizationEvidenceCandidate,
  right: OrganizationEvidenceCandidate,
) {
  return (
    right.combinedScore - left.combinedScore ||
    right.semanticScore - left.semanticScore ||
    right.lexicalScore - left.lexicalScore ||
    left.chunkId.localeCompare(right.chunkId)
  );
}

function toDecision(
  candidate: OrganizationEvidenceCandidate,
  reason: OrganizationEvidenceDecision["reason"],
): OrganizationEvidenceDecision {
  return {
    chunkId: candidate.chunkId,
    reason,
    lexicalScore: candidate.lexicalScore,
    semanticScore: candidate.semanticScore,
    combinedScore: candidate.combinedScore,
  };
}
