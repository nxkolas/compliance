import { describe, expect, it } from "vitest";
import { buildReassessmentEvidenceSelection } from "@/src/server/gap-analysis/reassessment-selection";

describe("buildReassessmentEvidenceSelection", () => {
  it("carries accepted current evidence, replaces superseded versions, and adds explicit evidence", () => {
    const result = buildReassessmentEvidenceSelection({
      accepted: [
        { versionId: "policy-v1", documentId: "policy" },
        { versionId: "runbook-v1", documentId: "runbook" },
      ],
      candidates: [
        current("policy-v1", "policy"),
        { ...current("runbook-v2", "runbook"), currentVersionId: "runbook-v2" },
        current("audit-v1", "audit"),
      ],
      explicitAdditions: ["audit-v1"],
    });

    expect(result).toEqual({
      selection: [
        { versionId: "policy-v1", documentId: "policy", origin: "approved_carryover" },
        { versionId: "runbook-v2", documentId: "runbook", origin: "version_replacement" },
        { versionId: "audit-v1", documentId: "audit", origin: "explicit_addition" },
      ],
      removed: [],
      blocked: [],
    });
  });

  it("removes archived accepted documents and blocks unindexed replacements", () => {
    const result = buildReassessmentEvidenceSelection({
      accepted: [
        { versionId: "archived-v1", documentId: "archived" },
        { versionId: "pending-v1", documentId: "pending" },
      ],
      candidates: [
        {
          versionId: "archived-v1",
          documentId: "archived",
          currentVersionId: "archived-v1",
          active: false,
          indexed: true,
        },
        {
          versionId: "pending-v2",
          documentId: "pending",
          currentVersionId: "pending-v2",
          active: true,
          indexed: false,
        },
      ],
      explicitAdditions: [],
    });

    expect(result.removed).toEqual(["archived-v1"]);
    expect(result.blocked).toEqual(["pending-v1"]);
    expect(result.selection).toEqual([]);
  });

  it("rejects explicit additions that are not indexed current versions", () => {
    const result = buildReassessmentEvidenceSelection({
      accepted: [],
      candidates: [
        {
          versionId: "old-v1",
          documentId: "policy",
          currentVersionId: "policy-v2",
          active: true,
          indexed: true,
        },
      ],
      explicitAdditions: ["old-v1", "missing"],
    });

    expect(result.blocked).toEqual(["old-v1", "missing"]);
  });
});

function current(versionId: string, documentId: string) {
  return {
    versionId,
    documentId,
    currentVersionId: versionId,
    active: true,
    indexed: true,
  };
}
