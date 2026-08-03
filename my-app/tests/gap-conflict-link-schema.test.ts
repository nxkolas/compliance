import { describe, expect, it } from "vitest";
import {
  contextLinkDispositionEnum,
  contextLinkRelationshipEnum,
  documentChunks,
  gapFindingContextLinks,
  legalSourceChunks,
} from "@/src/db/schema";

describe("Gap finding evidence-link identity", () => {
  it("keeps evidence relationship separate from resolution disposition", () => {
    expect(contextLinkRelationshipEnum.enumValues).toEqual([
      "supporting",
      "conflicting",
    ]);
    expect(contextLinkDispositionEnum.enumValues).toEqual([
      "admitted",
      "rejected",
    ]);
    expect(gapFindingContextLinks.relationship.notNull).toBe(true);
    expect(gapFindingContextLinks.disposition.notNull).toBe(true);
  });

  it("owns both stored chunk search vectors in Drizzle", () => {
    expect(documentChunks.searchVector.generated).toMatchObject({
      type: "always",
      mode: "stored",
    });
    expect(legalSourceChunks.searchVector.generated).toMatchObject({
      type: "always",
      mode: "stored",
    });
  });
});
