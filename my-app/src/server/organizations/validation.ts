import * as z from "zod";

export const organizationIdSchema = z.uuid();
export const invitationIdSchema = z.uuid();

export const organizationRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "auditor",
]);

export const assignableOrganizationRoleSchema = z.enum([
  "admin",
  "member",
  "auditor",
]);

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  legalName: z.string().trim().max(255).nullish(),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .default("DE"),
});

export const updateOrganizationSchema = createOrganizationSchema;

export const createOrganizationInvitationSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: assignableOrganizationRoleSchema.default("member"),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const acceptOrganizationInvitationSchema = z.object({
  token: z.string().trim().min(1),
});
