import * as z from "zod";

export const aiProviderModeSchema = z.enum([
  "company_hosted",
  "openai",
  "self_hosted",
]);

export const organizationInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(240).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .default("DE"),
  aiProviderMode: aiProviderModeSchema.default("company_hosted"),
});

export const organizationListQuerySchema = z.object({
  status: z.enum(["active", "archived"]).default("active"),
  query: z.string().trim().max(200).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const organizationRoleSchema = z.enum([
  "owner",
  "contributor",
  "viewer",
]);
export const assignableOrganizationRoleSchema = z.enum([
  "contributor",
  "viewer",
]);
export const organizationIdSchema = z.uuid();
export const invitationIdSchema = z.uuid();

export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  legalName: z.string().nullable(),
  countryCode: z.string().length(2),
  aiProviderMode: aiProviderModeSchema,
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const organizationListItemSchema = organizationSchema.extend({
  activeMemberCount: z.number().int().nonnegative(),
  currentUserRole: organizationRoleSchema,
  allowedActions: z.object({
    edit: z.boolean(),
    manageMembers: z.boolean(),
    archive: z.boolean(),
    restore: z.boolean(),
  }),
});

export const invitationInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: assignableOrganizationRoleSchema.default("contributor"),
});

export const invitationSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  email: z.email(),
  role: assignableOrganizationRoleSchema,
  invitedBy: z.uuid(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  token: z.string().optional(),
  organization: organizationSchema.optional(),
});

export const membershipSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: organizationRoleSchema,
  createdAt: z.iso.datetime(),
});

export const organizationMemberSchema = membershipSchema.extend({
  email: z.string(),
  displayName: z.string().nullable(),
  identityResolved: z.boolean(),
});

export const memberUpdateSchema = z
  .object({ role: organizationRoleSchema })
  .strict();
export const acceptOrganizationInvitationSchema = z.object({
  token: z.string().trim().min(1),
});

export const organizationSettingsSchema = z.object({
  organization: organizationSchema,
  allowedActions: z.object({ edit: z.boolean() }),
});

export const organizationSettingsUpdateSchema = z.object({
  organization: organizationInputSchema,
});
