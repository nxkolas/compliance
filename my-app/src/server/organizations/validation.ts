import { invitationInputSchema, organizationInputSchema } from "@/src/contracts/organizations";

export {
  acceptOrganizationInvitationSchema,
  assignableOrganizationRoleSchema,
  invitationIdSchema,
  organizationIdSchema,
  organizationRoleSchema,
} from "@/src/contracts/organizations";

export const createOrganizationSchema = organizationInputSchema;

export const updateOrganizationSchema = createOrganizationSchema;

export const createOrganizationInvitationSchema = invitationInputSchema;
