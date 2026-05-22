import type {
  organizationInvitations,
  organizationMembers,
  organizations,
  selfCheckAssessments,
} from "@/src/db/schema";
import type * as z from "zod";
import type {
  acceptOrganizationInvitationSchema,
  createOrganizationInvitationSchema,
  createOrganizationSchema,
  createSelfCheckAssessmentSchema,
} from "./validation";

export type OrganizationRole =
  (typeof organizationMembers.$inferSelect)["role"];

export type OrganizationInvitationStatus =
  (typeof organizationInvitations.$inferSelect)["status"];

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

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
