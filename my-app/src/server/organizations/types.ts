import type {
  organizationFactDefinitions,
  organizationFactValues,
  organizationInvitations,
  organizationMemberships,
  organizations,
} from "@/src/db/schema";
import type * as z from "zod";
import type {
  acceptOrganizationInvitationSchema,
  createOrganizationInvitationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} from "./validation";

export type OrganizationRole =
  (typeof organizationMemberships.$inferSelect)["role"];

export type OrganizationInvitationStatus =
  (typeof organizationInvitations.$inferSelect)["status"];

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export type CreateOrganizationInvitationInput = z.infer<
  typeof createOrganizationInvitationSchema
>;

export type AcceptOrganizationInvitationInput = z.infer<
  typeof acceptOrganizationInvitationSchema
>;

export type OrganizationDto = typeof organizations.$inferSelect;

export type OrganizationFactDto = typeof organizationFactValues.$inferSelect & {
  definition: typeof organizationFactDefinitions.$inferSelect;
  valueLabel: string | null;
};

export type OrganizationMembershipDto =
  typeof organizationMemberships.$inferSelect;

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
