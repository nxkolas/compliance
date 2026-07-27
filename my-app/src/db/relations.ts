import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  organizations: {
    memberships: r.many.organizationMemberships(),
    invitations: r.many.organizationInvitations(),
    factValues: r.many.organizationFactValues(),
    assessments: r.many.assessments(),
    generatedArtifacts: r.many.generatedArtifacts(),
  },
  organizationMemberships: {
    organization: r.one.organizations({
      from: r.organizationMemberships.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
  },
  organizationInvitations: {
    organization: r.one.organizations({
      from: r.organizationInvitations.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
  },
  organizationFactDefinitions: {
    values: r.many.organizationFactValues(),
    questionMappings: r.many.questionFactMappings(),
  },
  organizationFactValues: {
    organization: r.one.organizations({
      from: r.organizationFactValues.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    definition: r.one.organizationFactDefinitions({
      from: r.organizationFactValues.factKey,
      to: r.organizationFactDefinitions.key,
      optional: false,
    }),
  },
  complianceFrameworks: {
    versions: r.many.complianceFrameworkVersions(),
  },
  complianceFrameworkVersions: {
    framework: r.one.complianceFrameworks({
      from: r.complianceFrameworkVersions.frameworkId,
      to: r.complianceFrameworks.id,
      optional: false,
    }),
    nameContentRevision: r.one.contentRevisions({
      from: r.complianceFrameworkVersions.nameContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
    descriptionContentRevision: r.one.contentRevisions({
      from: r.complianceFrameworkVersions.descriptionContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
    modules: r.many.complianceModules(),
  },
  complianceModules: {
    frameworkVersion: r.one.complianceFrameworkVersions({
      from: r.complianceModules.frameworkVersionId,
      to: r.complianceFrameworkVersions.id,
      optional: false,
    }),
    nameContentRevision: r.one.contentRevisions({
      from: r.complianceModules.nameContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
    questionnaires: r.many.questionnaires(),
    assessments: r.many.assessments(),
    ruleSets: r.many.ruleSets(),
    generatedArtifacts: r.many.generatedArtifacts(),
  },
  questionnaires: {
    module: r.one.complianceModules({
      from: r.questionnaires.moduleId,
      to: r.complianceModules.id,
      optional: false,
    }),
    versions: r.many.questionnaireVersions(),
    assessments: r.many.assessments(),
  },
  questionnaireVersions: {
    questionnaire: r.one.questionnaires({
      from: r.questionnaireVersions.questionnaireId,
      to: r.questionnaires.id,
      optional: false,
    }),
    titleContentRevision: r.one.contentRevisions({
      from: r.questionnaireVersions.titleContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
    questions: r.many.questions(),
    assessmentRevisions: r.many.assessmentRevisions(),
  },
  gapRequirementSets: {
    versions: r.many.gapRequirementSetVersions(),
  },
  gapRequirementSetVersions: {
    requirementSet: r.one.gapRequirementSets({
      from: r.gapRequirementSetVersions.requirementSetId,
      to: r.gapRequirementSets.id,
      optional: false,
    }),
    titleContentRevision: r.one.contentRevisions({
      from: r.gapRequirementSetVersions.titleContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
    members: r.many.gapRequirementSetMembers(),
  },
  gapRequirementSetMembers: {
    requirementSetVersion: r.one.gapRequirementSetVersions({
      from: r.gapRequirementSetMembers.requirementSetVersionId,
      to: r.gapRequirementSetVersions.id,
      optional: false,
    }),
  },
  gapRequirementVersions: {
    requirement: r.one.gapRequirements({
      from: r.gapRequirementVersions.requirementId,
      to: r.gapRequirements.id,
      optional: false,
    }),
    titleContentRevision: r.one.contentRevisions({
      from: r.gapRequirementVersions.titleContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
    requirementTextContentRevision: r.one.contentRevisions({
      from: r.gapRequirementVersions.requirementTextContentRevisionId,
      to: r.contentRevisions.id,
      optional: false,
    }),
  },
  questions: {
    questionnaireVersion: r.one.questionnaireVersions({
      from: r.questions.questionnaireVersionId,
      to: r.questionnaireVersions.id,
      optional: false,
    }),
    options: r.many.questionOptions(),
    factMappings: r.many.questionFactMappings(),
  },
  questionOptions: {
    question: r.one.questions({
      from: r.questionOptions.questionId,
      to: r.questions.id,
      optional: false,
    }),
  },
  questionFactMappings: {
    question: r.one.questions({
      from: r.questionFactMappings.questionId,
      to: r.questions.id,
      optional: false,
    }),
    factDefinition: r.one.organizationFactDefinitions({
      from: r.questionFactMappings.factKey,
      to: r.organizationFactDefinitions.key,
      optional: false,
    }),
  },
  assessments: {
    organization: r.one.organizations({
      from: r.assessments.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    module: r.one.complianceModules({
      from: r.assessments.moduleId,
      to: r.complianceModules.id,
      optional: false,
    }),
    questionnaire: r.one.questionnaires({
      from: r.assessments.questionnaireId,
      to: r.questionnaires.id,
      optional: false,
    }),
    currentRevision: r.one.assessmentRevisions({
      from: r.assessments.currentRevisionId,
      to: r.assessmentRevisions.id,
    }),
    revisions: r.many.assessmentRevisions(),
  },
  assessmentRevisions: {
    assessment: r.one.assessments({
      from: r.assessmentRevisions.assessmentId,
      to: r.assessments.id,
      optional: false,
    }),
    questionnaireVersion: r.one.questionnaireVersions({
      from: r.assessmentRevisions.questionnaireVersionId,
      to: r.questionnaireVersions.id,
      optional: false,
    }),
    parentRevision: r.one.assessmentRevisions({
      from: r.assessmentRevisions.parentRevisionId,
      to: r.assessmentRevisions.id,
    }),
    answers: r.many.assessmentAnswers(),
  },
  assessmentAnswers: {
    revision: r.one.assessmentRevisions({
      from: r.assessmentAnswers.assessmentRevisionId,
      to: r.assessmentRevisions.id,
      optional: false,
    }),
    question: r.one.questions({
      from: r.assessmentAnswers.questionId,
      to: r.questions.id,
      optional: false,
    }),
  },
  guestApplicabilityChecks: {
    checkRelease: r.one.complianceCheckReleases({
      from: r.guestApplicabilityChecks.checkReleaseId,
      to: r.complianceCheckReleases.id,
      optional: false,
    }),
    claimedOrganization: r.one.organizations({
      from: r.guestApplicabilityChecks.claimedOrganizationId,
      to: r.organizations.id,
    }),
  },
  ruleSets: {
    module: r.one.complianceModules({
      from: r.ruleSets.moduleId,
      to: r.complianceModules.id,
      optional: false,
    }),
    generatedArtifactRevisions: r.many.generatedArtifactRevisions(),
  },
  generatedArtifacts: {
    organization: r.one.organizations({
      from: r.generatedArtifacts.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    module: r.one.complianceModules({
      from: r.generatedArtifacts.moduleId,
      to: r.complianceModules.id,
      optional: false,
    }),
    currentRevision: r.one.generatedArtifactRevisions({
      from: r.generatedArtifacts.currentRevisionId,
      to: r.generatedArtifactRevisions.id,
      alias: "artifact_current_revision",
    }),
    acceptedRevision: r.one.generatedArtifactRevisions({
      from: r.generatedArtifacts.acceptedRevisionId,
      to: r.generatedArtifactRevisions.id,
      alias: "artifact_accepted_revision",
    }),
    revisions: r.many.generatedArtifactRevisions(),
  },
  generatedArtifactRevisions: {
    artifact: r.one.generatedArtifacts({
      from: r.generatedArtifactRevisions.artifactId,
      to: r.generatedArtifacts.id,
      optional: false,
    }),
    ruleSet: r.one.ruleSets({
      from: r.generatedArtifactRevisions.ruleSetId,
      to: r.ruleSets.id,
    }),
    parentRevision: r.one.generatedArtifactRevisions({
      from: r.generatedArtifactRevisions.parentRevisionId,
      to: r.generatedArtifactRevisions.id,
    }),
    assessmentSources: r.many.artifactRevisionAssessmentSources(),
    artifactSources: r.many.artifactRevisionArtifactSources({
      alias: "artifact_revision_artifact_sources_owner",
    }),
    documentSources: r.many.artifactRevisionDocumentSources(),
  },
  artifactRevisionAssessmentSources: {
    artifactRevision: r.one.generatedArtifactRevisions({
      from: r.artifactRevisionAssessmentSources.artifactRevisionId,
      to: r.generatedArtifactRevisions.id,
      optional: false,
    }),
    assessmentRevision: r.one.assessmentRevisions({
      from: r.artifactRevisionAssessmentSources.assessmentRevisionId,
      to: r.assessmentRevisions.id,
      optional: false,
    }),
  },
  artifactRevisionArtifactSources: {
    artifactRevision: r.one.generatedArtifactRevisions({
      from: r.artifactRevisionArtifactSources.artifactRevisionId,
      to: r.generatedArtifactRevisions.id,
      optional: false,
      alias: "artifact_revision_artifact_sources_owner",
    }),
    sourceArtifactRevision: r.one.generatedArtifactRevisions({
      from: r.artifactRevisionArtifactSources.sourceArtifactRevisionId,
      to: r.generatedArtifactRevisions.id,
      optional: false,
      alias: "artifact_revision_artifact_sources_source",
    }),
  },
  artifactRevisionDocumentSources: {
    artifactRevision: r.one.generatedArtifactRevisions({
      from: r.artifactRevisionDocumentSources.artifactRevisionId,
      to: r.generatedArtifactRevisions.id,
      optional: false,
    }),
    documentVersion: r.one.documentVersions({
      from: r.artifactRevisionDocumentSources.documentVersionId,
      to: r.documentVersions.id,
      optional: false,
    }),
  },
  gapFindings: {
    gaps: r.many.gapItems(),
    evidence: r.many.gapFindingEvidence(),
    actions: r.many.actionPlanItems(),
  },
  gapFindingEvidence: {
    finding: r.one.gapFindings({
      from: r.gapFindingEvidence.findingId,
      to: r.gapFindings.id,
      optional: false,
    }),
    gapLinks: r.many.gapItemEvidence(),
  },
  gapItems: {
    finding: r.one.gapFindings({
      from: r.gapItems.findingId,
      to: r.gapFindings.id,
      optional: false,
    }),
    evidenceLinks: r.many.gapItemEvidence(),
    actionLinks: r.many.actionPlanItemGaps(),
  },
  gapItemEvidence: {
    gap: r.one.gapItems({
      from: r.gapItemEvidence.gapItemId,
      to: r.gapItems.id,
      optional: false,
    }),
    evidence: r.one.gapFindingEvidence({
      from: r.gapItemEvidence.gapFindingEvidenceId,
      to: r.gapFindingEvidence.id,
      optional: false,
    }),
  },
  actionPlans: {
    items: r.many.actionPlanItems(),
  },
  actionPlanItems: {
    plan: r.one.actionPlans({
      from: r.actionPlanItems.actionPlanId,
      to: r.actionPlans.id,
      optional: false,
    }),
    sourceFinding: r.one.gapFindings({
      from: r.actionPlanItems.sourceFindingId,
      to: r.gapFindings.id,
      optional: false,
    }),
    gapLinks: r.many.actionPlanItemGaps(),
  },
  actionPlanItemGaps: {
    action: r.one.actionPlanItems({
      from: r.actionPlanItemGaps.actionPlanItemId,
      to: r.actionPlanItems.id,
      optional: false,
    }),
    gap: r.one.gapItems({
      from: r.actionPlanItemGaps.gapItemId,
      to: r.gapItems.id,
      optional: false,
    }),
  },
}));
