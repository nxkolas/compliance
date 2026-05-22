import { db } from "@/src/db";
import {
  organizationInvitations,
  organizationMembers,
  organizations,
} from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { ApiError } from "../api/errors";
import type {
  AcceptOrganizationInvitationInput,
  CreateOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitationDto,
  OrganizationDto,
  OrganizationInvitationDto,
  OrganizationRole,
} from "./types";

const assignableRoles: OrganizationRole[] = ["admin", "member", "auditor"];
const organizationManagerRoles: OrganizationRole[] = ["owner", "admin"];

export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationDto[]> {
  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: {
      organization: true,
    },
  });

  return memberships.map((membership) => membership.organization);
}

export async function createOrganizationForUser(
  userId: string,
  input: CreateOrganizationInput,
): Promise<OrganizationDto> {
  const name = normalizeRequiredString(input.name, "name");

  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        name,
        legalName: normalizeOptionalString(input.legalName),
        industryDescription: normalizeOptionalString(input.industryDescription),
        employeeCount: normalizeOptionalInteger(input.employeeCount),
        annualRevenueEur: normalizeOptionalMoney(input.annualRevenueEur),
        balanceSheetTotalEur: normalizeOptionalMoney(
          input.balanceSheetTotalEur,
        ),
        size: input.size ?? null,
        countryCode: normalizeCountryCode(input.countryCode),
      })
      .returning();

    await tx.insert(organizationMembers).values({
      organizationId: organization.id,
      userId,
      role: "owner",
    });

    return organization;
  });
}

export async function listOrganizationInvitations(
  userId: string,
  organizationId: string,
): Promise<OrganizationInvitationDto[]> {
  await assertCanManageOrganization(userId, organizationId);

  const invitations = await db.query.organizationInvitations.findMany({
    where: eq(organizationInvitations.organizationId, organizationId),
    orderBy: (invitation, { desc }) => [desc(invitation.createdAt)],
  });

  return invitations.map(toInvitationDto);
}

export async function createOrganizationInvitation(
  invitedByUserId: string,
  organizationId: string,
  input: CreateOrganizationInvitationInput,
): Promise<CreatedOrganizationInvitationDto> {
  await assertCanManageOrganization(invitedByUserId, organizationId);

  const email = normalizeEmail(input.email);
  const role = normalizeInvitationRole(input.role);
  const expiresAt = createExpiryDate(input.expiresInDays);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);

  const invitation = await db.transaction(async (tx) => {
    await tx
      .update(organizationInvitations)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.email, email),
          eq(organizationInvitations.status, "pending"),
        ),
      );

    const [createdInvitation] = await tx
      .insert(organizationInvitations)
      .values({
        organizationId,
        email,
        role,
        invitedByUserId,
        tokenHash,
        expiresAt,
      })
      .returning();

    return createdInvitation;
  });

  return {
    ...toInvitationDto(invitation),
    token,
  };
}

export async function acceptOrganizationInvitation(
  user: User,
  input: AcceptOrganizationInvitationInput,
): Promise<OrganizationInvitationDto> {
  const token = normalizeRequiredString(input.token, "token");
  const tokenHash = hashInvitationToken(token);
  const invitation = await db.query.organizationInvitations.findFirst({
    where: eq(organizationInvitations.tokenHash, tokenHash),
  });

  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new ApiError(409, `Invitation is ${invitation.status}`);
  }

  if (invitation.expiresAt <= new Date()) {
    await db
      .update(organizationInvitations)
      .set({
        status: "expired",
        updatedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invitation.id));

    throw new ApiError(410, "Invitation has expired");
  }

  if (!user.email || normalizeEmail(user.email) !== invitation.email) {
    throw new ApiError(403, "Invitation belongs to a different email address");
  }

  const acceptedInvitation = await db.transaction(async (tx) => {
    await tx
      .insert(organizationMembers)
      .values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
      })
      .onConflictDoNothing({
        target: [organizationMembers.organizationId, organizationMembers.userId],
      });

    const [updatedInvitation] = await tx
      .update(organizationInvitations)
      .set({
        acceptedByUserId: user.id,
        acceptedAt: new Date(),
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invitation.id))
      .returning();

    return updatedInvitation;
  });

  return toInvitationDto(acceptedInvitation);
}

async function assertCanManageOrganization(
  userId: string,
  organizationId: string,
) {
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
    ),
  });

  if (!membership) {
    throw new ApiError(404, "Organization not found");
  }

  if (!organizationManagerRoles.includes(membership.role)) {
    throw new ApiError(403, "You cannot manage invitations for this organization");
  }

  return membership;
}

function toInvitationDto(
  invitation: typeof organizationInvitations.$inferSelect,
): OrganizationInvitationDto {
  const { tokenHash, ...dto } = invitation;
  void tokenHash;

  return dto;
}

function normalizeInvitationRole(role: OrganizationRole | undefined): OrganizationRole {
  const nextRole = role ?? "member";

  if (!assignableRoles.includes(nextRole)) {
    throw new ApiError(400, "role must be admin, member, or auditor");
  }

  return nextRole;
}

function createExpiryDate(expiresInDays: number | undefined): Date {
  const days = expiresInDays ?? 14;

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new ApiError(400, "expiresInDays must be between 1 and 90");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  return expiresAt;
}

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  const normalizedEmail = normalizeRequiredString(email, "email").toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new ApiError(400, "email must be a valid email address");
  }

  return normalizedEmail;
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `${fieldName} is required`);
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "Expected a string value");
  }

  return value.trim();
}

function normalizeOptionalInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiError(400, "Expected a positive integer value");
  }

  return value;
}

function normalizeOptionalMoney(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || Number.isNaN(Number(value))) {
    throw new ApiError(400, "Expected a decimal string value");
  }

  return value;
}

function normalizeCountryCode(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "DE";
  }

  if (typeof value !== "string" || value.trim().length !== 2) {
    throw new ApiError(400, "countryCode must be a two-letter country code");
  }

  return value.trim().toUpperCase();
}
