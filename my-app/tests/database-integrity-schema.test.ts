import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  activeComplianceCheckReleases,
  activeGapAnalysisReleases,
  activeLegalCorpusReleases,
  actionPlans,
  aiProcessingRuns,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  complianceCheckReleases,
  documents,
  documentVersions,
  backgroundJobs,
  gapAnalysisReleases,
  gapFindingReviewResolutions,
  gapFindings,
  generatedArtifactRevisions,
  generatedArtifacts,
  legalCorpusReleases,
  legalSourceVersions,
  questionnaireVersions,
  questions,
  reports,
  uploadSessions,
} from "@/src/db/schema";

function constraintNames(table: Parameters<typeof getTableConfig>[0]) {
  const config = getTableConfig(table);
  return [
    ...config.foreignKeys.map((foreignKey) => foreignKey.getName()),
    ...config.indexes.map((index) => index.config.name),
    ...config.uniqueConstraints.map((constraint) => constraint.name),
    ...config.checks.map((constraint) => constraint.name),
  ];
}

describe("database relational integrity", () => {
  it.each([
    [
      generatedArtifactRevisions,
      "generated_artifact_revisions_owner_identity_unique",
    ],
    [assessmentRevisions, "assessment_revisions_owner_identity_unique"],
    [documentVersions, "document_versions_owner_identity_unique"],
    [gapFindings, "gap_findings_revision_identity_unique"],
    [
      questionnaireVersions,
      "questionnaire_versions_id_questionnaire_unique",
    ],
    [questions, "questions_id_stable_key_unique"],
    [
      complianceCheckReleases,
      "compliance_check_releases_id_identity_unique",
    ],
    [gapAnalysisReleases, "gap_analysis_releases_id_identity_unique"],
    [legalCorpusReleases, "legal_corpus_releases_family_id_unique"],
  ])("exposes composite identity %s", (table, name) => {
    expect(constraintNames(table)).toContain(name);
  });

  it.each([
    [assessmentAnswers, "assessment_answers_question_identity_fk"],
    [
      gapFindingReviewResolutions,
      "gap_finding_review_resolutions_finding_revision_fk",
    ],
  ])("enforces owner-scoped pointer %s", (table, name) => {
    expect(constraintNames(table)).toContain(name);
  });

  it("keeps cyclic owner pointers in the Drizzle schema", () => {
    expect(constraintNames(generatedArtifacts)).toEqual(
      expect.arrayContaining([
        "generated_artifacts_current_revision_owner_fk",
        "generated_artifacts_accepted_revision_owner_fk",
      ]),
    );
    expect(constraintNames(assessments)).toContain(
      "assessments_current_revision_owner_fk",
    );
    expect(constraintNames(documents)).toContain(
      "documents_current_version_owner_fk",
    );
  });

  it.each([
    [
      activeComplianceCheckReleases,
      "active_compliance_check_releases_identity_fk",
    ],
    [activeGapAnalysisReleases, "active_gap_analysis_releases_identity_fk"],
    [activeLegalCorpusReleases, "active_legal_corpus_releases_identity_fk"],
  ])("binds active pointer keys to release identity %s", (table, name) => {
    expect(constraintNames(table)).toContain(name);
  });

  it("binds retained Assessment denormalizations to release identities", () => {
    expect(
      getTableConfig(complianceCheckReleases).columns.map(
        (column) => column.name,
      ),
    ).toContain("questionnaire_id");
    expect(
      getTableConfig(gapAnalysisReleases).columns.map((column) => column.name),
    ).toContain("questionnaire_id");
    expect(constraintNames(assessments)).toEqual(
      expect.arrayContaining([
        "assessments_compliance_release_identity_fk",
        "assessments_gap_release_identity_fk",
      ]),
    );
  });

  it("requires submitted assessment revisions to carry their timestamp", () => {
    expect(constraintNames(assessmentRevisions)).toContain(
      "assessment_revisions_submission_check",
    );
  });

  it.each([
    [aiProcessingRuns, "ai_processing_runs_lifecycle_check"],
    [reports, "reports_lifecycle_check"],
    [backgroundJobs, "background_jobs_lifecycle_check"],
    [uploadSessions, "upload_sessions_completion_check"],
    [actionPlans, "action_plans_lifecycle_check"],
    [legalSourceVersions, "legal_source_versions_lifecycle_check"],
    [legalCorpusReleases, "legal_corpus_releases_lifecycle_check"],
  ])("encodes lifecycle metadata invariant", (table, name) => {
    expect(constraintNames(table)).toContain(name);
  });
});
