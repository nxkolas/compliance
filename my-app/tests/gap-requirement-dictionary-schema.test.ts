import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { gapRequirementVersions } from "@/src/db/schema";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Gap requirement dictionary schema", () => {
  const config = getTableConfig(gapRequirementVersions);

  it("removes localized JSON title and requirement text columns", () => {
    const columns = config.columns.map((column) => column.name);

    expect(columns).not.toContain("title");
    expect(columns).not.toContain("requirement_text");
    expect(columns).not.toContain("legal_references");
  });

  it.each([
    [
      "title_content_revision_id",
      "gap_requirement_versions_title_content_fk",
    ],
    [
      "requirement_text_content_revision_id",
      "gap_requirement_versions_requirement_text_content_fk",
    ],
  ])(
    "requires restrictive content revision pin %s",
    (columnName, foreignKeyName) => {
      expect(
        config.columns.find((column) => column.name === columnName)?.notNull,
      ).toBe(true);
      const foreignKey = config.foreignKeys.find(
        (candidate) => candidate.getName() === foreignKeyName,
      );
      expect(foreignKey).toBeDefined();
      expect(foreignKey?.onDelete).toBe("restrict");
    },
  );

  it("publishes stable identity and revision pins without definition recommendations", () => {
    const publisher = readFileSync(
      join(
        process.cwd(),
        "src/server/gap-analysis/publishing/publish-release.ts",
      ),
      "utf8",
    );

    expect(publisher).toMatch(/titleContentRevisionId,\s+requirementTextContentRevisionId,/);
    expect(publisher).not.toMatch(/title:\s*source\.title/);
    expect(publisher).not.toMatch(/requirementText:\s*source\.requirementText/);
    expect(publisher).not.toMatch(/recommendation:\s*source\.recommendation/);
    expect(publisher).not.toMatch(/code:\s*source\.code,\s+versionLabel/);
    expect(publisher).not.toMatch(/legalReferences:\s*source\.legalReferences/);
    expect(publisher).toMatch(/gapQuestionLegalProvisions/);
    expect(publisher).toMatch(/gapRequirementQuestionMappings/);
  });
});
