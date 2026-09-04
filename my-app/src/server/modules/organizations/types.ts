import type {
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

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateOrganizationInvitationInput = z.infer<
  typeof createOrganizationInvitationSchema
>;
export type AcceptOrganizationInvitationInput = z.infer<
  typeof acceptOrganizationInvitationSchema
>;

export type OrganizationDto = typeof organizations.$inferSelect;

export type OrganizationListItem = OrganizationDto & {
  activeMemberCount: number;
  currentUserRole: OrganizationRole;
  allowedActions: {
    edit: boolean;
    manageMembers: boolean;
    archive: boolean;
    restore: boolean;
  };
};

export type OrganizationMembershipDto =
  typeof organizationMemberships.$inferSelect;
export type OrganizationMemberDto = OrganizationMembershipDto & {
  email: string;
  displayName: string | null;
  identityResolved: boolean;
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
