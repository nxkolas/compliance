import type {
  organizationInvitations,
  organizationMembers,
  organizations,
} from "@/src/db/schema";
import type * as z from "zod";
import type {
  acceptOrganizationInvitationSchema,
  createOrganizationInvitationSchema,
  createOrganizationSchema,
} from "./validation";

export type OrganizationRole =
  (typeof organizationMembers.$inferSelect)["role"];

export type OrganizationInvitationStatus =
  (typeof organizationInvitations.$inferSelect)["status"];

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export type CreateOrganizationInvitationInput = z.infer<
  typeof createOrganizationInvitationSchema
>;

export type AcceptOrganizationInvitationInput = z.infer<
  typeof acceptOrganizationInvitationSchema
>;

export type OrganizationDto = typeof organizations.$inferSelect;

export type OrganizationInvitationDto = Omit<
  typeof organizationInvitations.$inferSelect,
  "tokenHash"
>;

export type CreatedOrganizationInvitationDto = OrganizationInvitationDto & {
  token: string;
};
