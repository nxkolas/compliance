import { getTableConfig } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assessmentAnswerOptions,
  assessmentAnswers,
  factOptions,
  organizationFactValueOptions,
  organizationFactValues,
  questionOptions,
} from "@/src/db/schema";

function names(table: Parameters<typeof getTableConfig>[0]) {
  const config = getTableConfig(table);
  return [
    ...config.foreignKeys.map((foreignKey) => foreignKey.getName()),
    ...config.uniqueConstraints.map((constraint) => constraint.name),
    ...config.checks.map((constraint) => constraint.name),
  ];
}

describe("database typed Answer and Fact persistence", () => {
  it("binds selected answer options through their Question", () => {
    expect(
      getTableConfig(assessmentAnswerOptions).columns.map(
        (column) => column.name,
      ),
    ).toContain("question_id");
    expect(names(assessmentAnswers)).toContain(
      "assessment_answers_id_question_unique",
    );
    expect(names(questionOptions)).toContain(
      "question_options_question_id_unique",
    );
    expect(names(assessmentAnswerOptions)).toEqual(
      expect.arrayContaining([
        "assessment_answer_options_answer_question_fk",
        "assessment_answer_options_question_option_fk",
      ]),
    );
  });

  it("binds selected fact options through their Fact Definition", () => {
    expect(
      getTableConfig(organizationFactValueOptions).columns.map(
        (column) => column.name,
      ),
    ).toContain("fact_key");
    expect(names(organizationFactValues)).toContain(
      "organization_fact_values_id_fact_unique",
    );
    expect(names(factOptions)).toContain(
      "fact_options_definition_id_unique",
    );
    expect(names(organizationFactValueOptions)).toEqual(
      expect.arrayContaining([
        "organization_fact_value_options_value_fact_fk",
        "organization_fact_value_options_fact_option_fk",
      ]),
    );
  });

  it("limits headers to one scalar representation", () => {
    expect(names(assessmentAnswers)).toContain(
      "assessment_answers_scalar_representation_check",
    );
    expect(names(organizationFactValues)).toContain(
      "organization_fact_values_scalar_representation_check",
    );
  });

  it("installs deferred final datatype validation", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "scripts/sql/database-integrity-triggers.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("assessment_answers_datatype_trigger");
    expect(sql).toContain("organization_fact_values_datatype_trigger");
    expect(sql).toContain("deferrable initially deferred");
  });
});
