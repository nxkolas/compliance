import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  complianceFrameworks,
  complianceFrameworkVersions,
  complianceModules,
  gapRequirementSets,
  gapRequirementSetVersions,
  questionnaires,
  questionnaireVersions,
} from "@/src/db/schema";

describe("localized definition metadata schema", () => {
  it("removes fixed-language display columns from identity tables", () => {
    expect(columnNames(complianceFrameworks)).not.toEqual(
      expect.arrayContaining(["name", "description"]),
    );
    expect(columnNames(complianceModules)).not.toContain("name");
    expect(columnNames(questionnaires)).not.toContain("title");
    expect(columnNames(gapRequirementSets)).not.toContain("title");
  });

  it.each([
    [
      complianceFrameworkVersions,
      ["name_content_revision_id", "description_content_revision_id"],
      [
        "compliance_framework_versions_name_content_fk",
        "compliance_framework_versions_description_content_fk",
      ],
    ],
    [
      complianceModules,
      ["name_content_revision_id"],
      ["compliance_modules_name_content_fk"],
    ],
    [
      questionnaireVersions,
      ["title_content_revision_id"],
      ["questionnaire_versions_title_content_fk"],
    ],
    [
      gapRequirementSetVersions,
      ["title_content_revision_id"],
      ["gap_requirement_set_versions_title_content_fk"],
    ],
  ])(
    "requires immutable content revision references on %s",
    (table, expectedColumns, expectedForeignKeys) => {
      const config = getTableConfig(table);
      for (const columnName of expectedColumns) {
        expect(config.columns.find((column) => column.name === columnName)?.notNull)
          .toBe(true);
      }
      for (const foreignKeyName of expectedForeignKeys) {
        const foreignKey = config.foreignKeys.find(
          (candidate) => candidate.getName() === foreignKeyName,
        );
        expect(foreignKey).toBeDefined();
        expect(foreignKey?.onDelete).toBe("restrict");
      }
    },
  );
});

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}
