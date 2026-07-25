import { eq, getTableName, is, Table } from "drizzle-orm";
import {
  type AnyPgTable,
  getTableConfig,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { relations } from "@/src/db/relations";
import * as schema from "@/src/db/schema";

const schemaValues: unknown[] = Object.values(schema);
const tables = schemaValues
  .filter((value): value is AnyPgTable => is(value, Table))
  .sort((left, right) => getTableName(left).localeCompare(getTableName(right)));

const expectedCompositeForeignKeys = [
  "active_compliance_check_releases.active_compliance_check_releases_identity_fk:[check_code,check_release_id]->compliance_check_releases.[check_code,id]",
  "active_gap_analysis_releases.active_gap_analysis_releases_identity_fk:[release_code,gap_analysis_release_id]->gap_analysis_releases.[release_code,id]",
  "active_legal_corpus_releases.active_legal_corpus_releases_identity_fk:[family_id,release_id]->legal_corpus_releases.[family_id,id]",
  "assessment_answer_options.assessment_answer_options_answer_question_fk:[assessment_answer_id,question_id]->assessment_answers.[id,question_id]",
  "assessment_answer_options.assessment_answer_options_question_option_fk:[question_id,question_option_id]->question_options.[question_id,id]",
  "assessment_answers.assessment_answers_question_identity_fk:[question_id,question_stable_key]->questions.[id,stable_key]",
  "assessments.assessments_compliance_release_identity_fk:[check_release_id,module_id,questionnaire_id]->compliance_check_releases.[id,module_id,questionnaire_id]",
  "assessments.assessments_current_revision_owner_fk:[id,current_revision_id]->assessment_revisions.[assessment_id,id]",
  "assessments.assessments_gap_release_identity_fk:[gap_analysis_release_id,module_id,questionnaire_id]->gap_analysis_releases.[id,module_id,questionnaire_id]",
  "compliance_check_release_activations.compliance_release_activations_active_identity_fk:[check_code,activated_release_id]->compliance_check_releases.[check_code,id]",
  "compliance_check_release_activations.compliance_release_activations_previous_identity_fk:[check_code,previous_release_id]->compliance_check_releases.[check_code,id]",
  "compliance_check_releases.compliance_check_releases_questionnaire_module_identity_fk:[questionnaire_id,module_id]->questionnaires.[id,module_id]",
  "compliance_check_releases.compliance_check_releases_questionnaire_version_identity_fk:[questionnaire_version_id,questionnaire_id]->questionnaire_versions.[id,questionnaire_id]",
  "documents.documents_current_version_owner_fk:[id,current_version_id]->document_versions.[document_id,id]",
  "gap_analysis_release_activations.gap_analysis_release_activations_active_identity_fk:[release_code,activated_release_id]->gap_analysis_releases.[release_code,id]",
  "gap_analysis_release_activations.gap_analysis_release_activations_previous_identity_fk:[release_code,previous_release_id]->gap_analysis_releases.[release_code,id]",
  "gap_analysis_releases.gap_analysis_releases_questionnaire_module_identity_fk:[questionnaire_id,module_id]->questionnaires.[id,module_id]",
  "gap_analysis_releases.gap_analysis_releases_questionnaire_version_identity_fk:[questionnaire_version_id,questionnaire_id]->questionnaire_versions.[id,questionnaire_id]",
  "gap_finding_review_resolutions.gap_finding_review_resolutions_finding_revision_fk:[artifact_revision_id,finding_id]->gap_findings.[artifact_revision_id,id]",
  "gap_questionnaire_draft_answers.gap_questionnaire_draft_answers_question_option_fk:[question_id,question_option_id]->question_options.[question_id,id]",
  "gap_questionnaire_drafts.gap_questionnaire_drafts_assessment_org_fk:[assessment_id,organization_id]->assessments.[id,organization_id]",
  "gap_questionnaire_drafts.gap_questionnaire_drafts_assessment_release_fk:[assessment_id,gap_analysis_release_id]->assessments.[id,gap_analysis_release_id]",
  "gap_questionnaire_drafts.gap_questionnaire_drafts_release_questionnaire_fk:[gap_analysis_release_id,questionnaire_version_id]->gap_analysis_releases.[id,questionnaire_version_id]",
  "gap_reassessment_draft_documents.gap_reassessment_draft_documents_document_org_fk:[document_id,organization_id]->documents.[id,organization_id]",
  "gap_reassessment_draft_documents.gap_reassessment_draft_documents_draft_org_fk:[draft_id,organization_id]->gap_reassessment_drafts.[id,organization_id]",
  "gap_reassessment_draft_documents.gap_reassessment_draft_documents_version_fk:[document_version_id,document_id]->document_versions.[id,document_id]",
  "generated_artifacts.generated_artifacts_accepted_revision_owner_fk:[id,accepted_revision_id]->generated_artifact_revisions.[artifact_id,id]",
  "generated_artifacts.generated_artifacts_current_revision_owner_fk:[id,current_revision_id]->generated_artifact_revisions.[artifact_id,id]",
  "legal_corpus_release_activations.legal_release_activations_previous_identity_fk:[family_id,previous_release_id]->legal_corpus_releases.[family_id,id]",
  "legal_corpus_release_activations.legal_release_activations_release_identity_fk:[family_id,release_id]->legal_corpus_releases.[family_id,id]",
  "legal_source_renditions.legal_source_renditions_authority_version_fk:[authoritative_rendition_id,source_version_id]->legal_source_renditions.[id,source_version_id]",
  "organization_fact_value_options.organization_fact_value_options_fact_option_fk:[fact_key,fact_option_id]->fact_options.[fact_definition_key,id]",
  "organization_fact_value_options.organization_fact_value_options_value_fact_fk:[organization_fact_value_id,fact_key]->organization_fact_values.[id,fact_key]",
].sort();

describe("Drizzle v1 schema ownership", () => {
  it("declares both HNSW indexes exactly once and nowhere in operator SQL", () => {
    const indexNames = tables.flatMap((table) =>
      getTableConfig(table).indexes.map((index) => index.config.name),
    );
    const expected = [
      "document_chunk_embeddings_hnsw_idx",
      "legal_source_chunk_embeddings_hnsw_idx",
    ];

    for (const name of expected) {
      expect(indexNames.filter((candidate) => candidate === name)).toHaveLength(
        1,
      );
    }

    for (const file of sqlFiles("scripts/sql").concat(
      sqlFiles("supabase/sql-editor"),
    )) {
      expect(readFileSync(file, "utf8")).not.toMatch(
        new RegExp(`create\\s+index[^;]*(?:${expected.join("|")})`, "i"),
      );
    }
  });

  it("keeps every explicit constraint name within PostgreSQL's byte limit", () => {
    const names = tables.flatMap((table) => {
      const config = getTableConfig(table);
      return [
        ...config.primaryKeys
          .filter((key) => key.isNameExplicit)
          .map((key) => key.getName()),
        ...config.foreignKeys
          .filter((key) => key.isNameExplicit())
          .map((key) => key.getName()),
        ...config.uniqueConstraints.map((constraint) => constraint.name),
        ...config.checks.map((constraint) => constraint.name),
      ].filter((name): name is string => typeof name === "string");
    });

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(
        Buffer.byteLength(name, "utf8"),
        `${name} exceeds PostgreSQL's 63-byte identifier limit`,
      ).toBeLessThanOrEqual(63);
    }
  });

  it("preserves ordered source and target columns for every composite FK", () => {
    const actual = tables
      .flatMap((table) => {
        const tableName = getTableName(table);
        return getTableConfig(table).foreignKeys.flatMap((foreignKey) => {
          const reference = foreignKey.reference();
          if (reference.columns.length < 2) return [];
          return [
            `${tableName}.${foreignKey.getName()}:[${reference.columns.map((column) => column.name).join(",")}]->${getTableName(reference.foreignTable)}.[${reference.foreignColumns.map((column) => column.name).join(",")}]`,
          ];
        });
      })
      .sort();

    expect(actual).toEqual(expectedCompositeForeignKeys);
  });

});

describe("Drizzle RQB v2", () => {
  it("builds nested filtered and ordered reads", () => {
    const mockDb = drizzle.mock({ relations });
    const query = mockDb.query.organizations.findMany({
      where: {
        RAW: (table, operators) => (eq(
          table.id,
          "00000000-0000-0000-0000-000000000000",
        )) ?? operators.sql`true`,
      },
      orderBy: { createdAt: "desc" },
      with: {
        memberships: {
          where: {
            RAW: (table, operators) => (eq(table.status, "active")) ?? operators.sql`true`,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const prepared = query.prepare("rqb-v2-regression");
    const querySql = (
      prepared as unknown as { query: { sql: string } }
    ).query.sql;
    expect(querySql).toContain('"d0"."id"');
    expect(querySql).not.toContain('"organizations"."id"');
    expect(querySql).not.toContain(
      '"organization_memberships"."status"',
    );
  });

  it("keeps relational reads available inside transactions", () => {
    const mockDb = drizzle.mock({ relations });
    const transactionalRead = () =>
      mockDb.transaction((transaction) =>
        transaction.query.organizations.findFirst({
          where: {
            RAW: (table, operators) => (eq(
              table.id,
              "00000000-0000-0000-0000-000000000000",
            )) ?? operators.sql`true`,
          },
          with: { memberships: true },
        }),
      );

    expect(transactionalRead).toBeTypeOf("function");
  });
});

function sqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sqlFiles(path);
    return extname(entry.name) === ".sql" ? [path] : [];
  });
}
