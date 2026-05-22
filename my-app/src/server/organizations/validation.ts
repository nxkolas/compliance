import * as z from "zod";

const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Expected a decimal string with up to 2 decimals");

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
  industryDescription: z.string().trim().nullish(),
  employeeCount: z.number().int().nonnegative().nullish(),
  annualRevenueEur: moneySchema.nullish(),
  balanceSheetTotalEur: moneySchema.nullish(),
  size: z.enum(["micro", "small", "medium", "large"]).nullish(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .default("DE"),
});

export const createOrganizationInvitationSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: assignableOrganizationRoleSchema.default("member"),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const acceptOrganizationInvitationSchema = z.object({
  token: z.string().trim().min(1),
});
