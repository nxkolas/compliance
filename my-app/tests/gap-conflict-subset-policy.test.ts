import { describe, expect, it } from "vitest";
import {
  classifyFindingCitationLinks,
  resolvedFindingLinkDisposition,
} from "@/src/server/gap-analysis/evidence-link-policy";

describe("exact contradiction link policy", () => {
  it("marks only the provider-named organization citation as conflicting", () => {
    const links = classifyFindingCitationLinks({
      citationIds: ["LEGAL:a", "ORG:conflict", "ORG:support"],
      contextIdByCitation: new Map([
        ["LEGAL:a", "context-legal"],
        ["ORG:conflict", "context-conflict"],
        ["ORG:support", "context-support"],
      ]),
      conflictingOrganizationCitationIds: ["ORG:conflict"],
    });
    expect(links).toEqual([
      { citationId: "LEGAL:a", contextId: "context-legal", relationship: "supporting" },
      { citationId: "ORG:conflict", contextId: "context-conflict", relationship: "conflicting" },
      { citationId: "ORG:support", contextId: "context-support", relationship: "supporting" },
    ]);
  });

  it("questionnaire trust rejects only the exact conflicting target link", () => {
    const base = {
      currentDisposition: "admitted" as const,
      sourceChoice: "questionnaire" as const,
      isTargetFinding: true,
      isExactConflictingContext: true,
    };
    expect(resolvedFindingLinkDisposition({ ...base, relationship: "conflicting" })).toBe("rejected");
    expect(resolvedFindingLinkDisposition({ ...base, relationship: "supporting" })).toBe("admitted");
    expect(resolvedFindingLinkDisposition({ ...base, relationship: "conflicting", sourceChoice: "document" })).toBe("admitted");
    expect(resolvedFindingLinkDisposition({ ...base, relationship: "conflicting", isTargetFinding: false })).toBe("admitted");
  });
});
