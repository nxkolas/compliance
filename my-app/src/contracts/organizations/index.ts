import * as z from "zod";

export const organizationInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  legalName: z.string().trim().max(255).nullable().optional(),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()).default("DE"),
});
export const organizationRoleSchema = z.enum(["owner", "admin", "member", "auditor"]);
export const assignableOrganizationRoleSchema = z.enum(["admin", "member", "auditor"]);
export const organizationIdSchema = z.uuid();
export const invitationIdSchema = z.uuid();
export const organizationSchema = z.object({
  id: z.uuid(), name: z.string(), legalName: z.string().nullable(), country: z.string(), archivedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export const invitationInputSchema = z.object({
  email: z.email().trim().toLowerCase(), role: z.enum(["admin", "member", "auditor"]).default("member"),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});
export const invitationSchema = z.object({
  id: z.uuid(), organizationId: z.uuid(), email: z.email(), role: organizationRoleSchema,
  invitedByUserId: z.uuid(), acceptedByUserId: z.uuid().nullable(), status: z.enum(["pending", "accepted", "expired", "revoked"]),
  expiresAt: z.iso.datetime(), acceptedAt: z.iso.datetime().nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  token: z.string().optional(), organization: organizationSchema.optional(),
});
export const membershipSchema = z.object({
  id: z.uuid(), organizationId: z.uuid(), userId: z.uuid(), role: organizationRoleSchema,
  status: z.enum(["active", "suspended"]), version: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export const memberUpdateSchema = z.object({ role: organizationRoleSchema, status: z.enum(["active", "suspended"]) });
export const acceptOrganizationInvitationSchema = z.object({ token: z.string().trim().min(1) });

export const organizationAiProviderPolicySchema = z.object({
  organizationId: z.uuid(),
  allowedProviderModes: z.array(z.enum(["company_hosted", "openai", "self_hosted"])),
  externalDisclosureAllowed: z.boolean(),
  retentionClassification: z.string(),
  version: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
});

export const organizationAiProviderPolicyUpdateSchema = z.object({
  openAiDisclosureApproved: z.boolean(),
  reason: z.string().trim().min(1).max(1000),
});
