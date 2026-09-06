import { describe, expect, it } from "vitest";
import { buildAnalysisCycleEvidenceSelection } from "@/src/server/modules/gap-analysis/analysis-cycle-selection";

describe("buildAnalysisCycleEvidenceSelection", () => {
  it("treats the submitted documents as exact and resolves selected names to current versions", () => {
    const result = buildAnalysisCycleEvidenceSelection({
      accepted: [
        { versionId: "policy-v1", documentId: "policy" },
        { versionId: "runbook-v1", documentId: "runbook" },
      ],
      candidates: [
        current("policy-v1", "policy"),
        {
          ...current("runbook-v1", "runbook"),
          currentVersionId: "runbook-v2",
        },
        { ...current("runbook-v2", "runbook"), currentVersionId: "runbook-v2" },
        current("audit-v1", "audit"),
      ],
      explicitAdditions: ["policy-v1", "runbook-v1", "audit-v1"],
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

  it("allows removing every previously accepted document", () => {
    const result = buildAnalysisCycleEvidenceSelection({
      accepted: [
        { versionId: "archived-v1", documentId: "archived" },
        { versionId: "pending-v1", documentId: "pending" },
      ],
      candidates: [],
      explicitAdditions: [],
    });

    expect(result.removed).toEqual(["archived-v1", "pending-v1"]);
    expect(result.blocked).toEqual([]);
    expect(result.selection).toEqual([]);
  });

  it("records omitted carried evidence as removed", () => {
    const result = buildAnalysisCycleEvidenceSelection({
      accepted: [
        { versionId: "policy-v1", documentId: "policy" },
        { versionId: "runbook-v1", documentId: "runbook" },
      ],
      candidates: [current("policy-v1", "policy"), current("runbook-v1", "runbook")],
      explicitAdditions: ["policy-v1"],
    });

    expect(result.selection).toEqual([
      { versionId: "policy-v1", documentId: "policy", origin: "approved_carryover" },
    ]);
    expect(result.removed).toEqual(["runbook-v1"]);
  });

  it("rejects explicit additions that are not indexed current versions", () => {
    const result = buildAnalysisCycleEvidenceSelection({
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
