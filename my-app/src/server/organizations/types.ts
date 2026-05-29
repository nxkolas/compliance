import type {
  actionPlanItems,
  documentRequirementTypes,
  documentReviewFindings,
  documentReviewRuns,
  nis2CriticalServices,
  organizationCriticalServices,
  organizationInvitations,
  organizationMembers,
  organizationSettings,
  organizations,
  questionnaireAnswers,
  questionnaireQuestions,
  questionnaireRuns,
  questionnaireSections,
  questionnaireTemplates,
  reportExports,
  selfCheckAssessments,
  userPreferences,
} from "@/src/db/schema";
import type * as z from "zod";
import type {
  acceptOrganizationInvitationSchema,
  createOrganizationInvitationSchema,
  createOrganizationSchema,
  createSelfCheckAssessmentSchema,
  updateOrganizationSchema,
} from "./validation";

export type OrganizationRole =
  (typeof organizationMembers.$inferSelect)["role"];

export type OrganizationInvitationStatus =
  (typeof organizationInvitations.$inferSelect)["status"];

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export type CreateOrganizationInvitationInput = z.infer<
  typeof createOrganizationInvitationSchema
>;

export type CreateSelfCheckAssessmentInput = z.infer<
  typeof createSelfCheckAssessmentSchema
>;

export type AcceptOrganizationInvitationInput = z.infer<
  typeof acceptOrganizationInvitationSchema
>;

export type OrganizationDto = typeof organizations.$inferSelect;

export type SelfCheckAssessmentDto = typeof selfCheckAssessments.$inferSelect;

export type Nis2CriticalServiceDto = typeof nis2CriticalServices.$inferSelect;

export type OrganizationCriticalServiceDto =
  typeof organizationCriticalServices.$inferSelect;

export type QuestionnaireTemplateDto =
  typeof questionnaireTemplates.$inferSelect;

export type QuestionnaireSectionDto = typeof questionnaireSections.$inferSelect;

export type QuestionnaireQuestionDto =
  typeof questionnaireQuestions.$inferSelect;

export type QuestionnaireRunDto = typeof questionnaireRuns.$inferSelect;

export type QuestionnaireAnswerDto = typeof questionnaireAnswers.$inferSelect;

export type DocumentRequirementTypeDto =
  typeof documentRequirementTypes.$inferSelect;

export type DocumentReviewRunDto = typeof documentReviewRuns.$inferSelect;

export type DocumentReviewFindingDto =
  typeof documentReviewFindings.$inferSelect;

export type ActionPlanItemDto = typeof actionPlanItems.$inferSelect;

export type ReportExportDto = typeof reportExports.$inferSelect;

export type UserPreferenceDto = typeof userPreferences.$inferSelect;

export type OrganizationSettingDto = typeof organizationSettings.$inferSelect;

export type SelfCheckAssessmentWithOrganizationDto =
  SelfCheckAssessmentDto & {
    organization: OrganizationDto;
  };

export type OrganizationInvitationDto = Omit<
  typeof organizationInvitations.$inferSelect,
  "tokenHash"
>;

export type OrganizationMailboxInvitationDto = OrganizationInvitationDto & {
  organization: OrganizationDto;
};

export type CreatedOrganizationInvitationDto = OrganizationInvitationDto & {
  token: string;
};
