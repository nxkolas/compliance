import { db } from "@/src/db";
import {
  assessmentRevisions,
  assessments,
  factOptions,
  organizationFactDefinitions,
  organizationFactValueOptions,
  organizationFactValues,
  organizationInvitations,
  organizationMemberships,
  organizations,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { ApiError } from "../api/errors";
import { loadComplianceRelease } from "../compliance/release-service";
import type {
  AcceptOrganizationInvitationInput,
  CreateOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitationDto,
  OrganizationDto,
  OrganizationFactDto,
  OrganizationInvitationDto,
  OrganizationMailboxInvitationDto,
  OrganizationRole,
  UpdateOrganizationInput,
} from "./types";

const assignableRoles: OrganizationRole[] = ["admin", "member", "auditor"];
const organizationManagerRoles: OrganizationRole[] = ["owner", "admin"];

export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationDto[]> {
  const memberships = await db.query.organizationMemberships.findMany({
    where: and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.status, "active"),
    ),
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
        country: normalizeCountry(input.country),
      })
      .returning();

    await tx.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId,
      role: "owner",
      status: "active",
    });

    return organization;
  });
}

export async function updateOrganizationForUser(
  userId: string,
  organizationId: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationDto> {
  await assertCanManageOrganization(userId, organizationId);
  const name = normalizeRequiredString(input.name, "name");

  const [organization] = await db
    .update(organizations)
    .set({
      name,
      legalName: normalizeOptionalString(input.legalName),
      country: normalizeCountry(input.country),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  return organization;
}

export async function getOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationDto | null> {
  const membership = await db.query.organizationMemberships.findFirst({
    where: and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.organizationId, organizationId),
      eq(organizationMemberships.status, "active"),
    ),
    with: {
      organization: true,
    },
  });

  return membership?.organization ?? null;
}

export async function listCurrentOrganizationFactsForUser(
  userId: string,
  organizationId: string,
  locale: Locale,
): Promise<OrganizationFactDto[]> {
  await assertCanAccessOrganization(userId, organizationId);

  const rows = await db.select({
    value: organizationFactValues,
    definition: organizationFactDefinitions,
    checkReleaseId: assessments.checkReleaseId,
  }).from(organizationFactValues)
    .innerJoin(organizationFactDefinitions, eq(organizationFactValues.factKey, organizationFactDefinitions.key))
    .innerJoin(assessmentRevisions, eq(organizationFactValues.sourceRevisionId, assessmentRevisions.id))
    .innerJoin(assessments, eq(assessmentRevisions.assessmentId, assessments.id))
    .where(and(
      eq(organizationFactValues.organizationId, organizationId),
      eq(organizationFactValues.isCurrent, true),
    ))
    .orderBy(desc(organizationFactValues.createdAt));
  if (rows.length === 0) return [];
  const optionRows = await db.select({
    valueId: organizationFactValueOptions.organizationFactValueId,
    stableValue: factOptions.stableValue,
  }).from(organizationFactValueOptions)
    .innerJoin(factOptions, eq(organizationFactValueOptions.factOptionId, factOptions.id))
    .where(inArray(organizationFactValueOptions.organizationFactValueId, rows.map((row) => row.value.id)));
  const releaseCache = new Map<string, Awaited<ReturnType<typeof loadComplianceRelease>>>();
  const result: OrganizationFactDto[] = [];
  for (const row of rows) {
    let release = releaseCache.get(row.checkReleaseId);
    if (release === undefined) {
      release = await loadComplianceRelease(row.checkReleaseId, locale);
      releaseCache.set(row.checkReleaseId, release);
    }
    const question = release?.questions.find((candidate) => candidate.factMappings.some((mapping) => mapping.factKey === row.value.factKey));
    const stableValues = optionRows.filter((option) => option.valueId === row.value.id).map((option) => option.stableValue);
    const labels = stableValues.map((stableValue) => question?.options.find((option) => option.stableValue === stableValue)?.label ?? stableValue);
    result.push({
      ...row.value,
      value: stableValues.length > 1 ? stableValues : stableValues[0] ?? row.value.textValue ?? row.value.numberValue ?? row.value.booleanValue ?? row.value.structuredValue,
      valueLabel: labels.length > 0 ? labels.join(", ") : null,
      definition: {
        ...row.definition,
        label: question?.questionText ?? row.definition.key,
        description: question?.helpText ?? null,
      },
    });
  }
  return result;
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

export async function listMailboxInvitationsForUser(
  user: User,
): Promise<OrganizationMailboxInvitationDto[]> {
  if (!user.email) {
    return [];
  }

  const invitations = await db.query.organizationInvitations.findMany({
    where: and(
      eq(organizationInvitations.email, normalizeEmail(user.email)),
      eq(organizationInvitations.status, "pending"),
    ),
    with: {
      organization: true,
    },
    orderBy: (invitation, { desc }) => [desc(invitation.createdAt)],
  });

  return invitations.map((invitation) => ({
    ...toInvitationDto(invitation),
    organization: invitation.organization,
  }));
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

  return acceptInvitationRecord(user, invitation);
}

export async function acceptMailboxInvitation(
  user: User,
  invitationId: string,
): Promise<OrganizationInvitationDto> {
  const invitation = await db.query.organizationInvitations.findFirst({
    where: eq(organizationInvitations.id, invitationId),
  });

  if (!invitation) {
    throw new ApiError(404, "Invitation not found");
  }

  return acceptInvitationRecord(user, invitation);
}

export async function assertCanAccessOrganization(
  userId: string,
  organizationId: string,
) {
  const membership = await db.query.organizationMemberships.findFirst({
    where: and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.organizationId, organizationId),
      eq(organizationMemberships.status, "active"),
    ),
  });

  if (!membership) {
    throw new ApiError(404, "Organization not found");
  }

  return membership;
}

export async function assertCanManageOrganization(
  userId: string,
  organizationId: string,
) {
  const membership = await assertCanAccessOrganization(userId, organizationId);

  if (!organizationManagerRoles.includes(membership.role)) {
    throw new ApiError(403, "You cannot manage this organization");
  }

  return membership;
}

async function acceptInvitationRecord(
  user: User,
  invitation: typeof organizationInvitations.$inferSelect,
) {
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
      .insert(organizationMemberships)
      .values({
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [
          organizationMemberships.organizationId,
          organizationMemberships.userId,
        ],
        set: {
          role: invitation.role,
          status: "active",
          updatedAt: new Date(),
        },
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

function toInvitationDto(
  invitation: typeof organizationInvitations.$inferSelect,
): OrganizationInvitationDto {
  const { tokenHash, ...dto } = invitation;
  void tokenHash;

  return dto;
}

function normalizeInvitationRole(role: OrganizationRole | undefined) {
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

function normalizeCountry(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "DE";
  }

  if (typeof value !== "string" || value.trim().length !== 2) {
    throw new ApiError(400, "country must be a two-letter country code");
  }

  return value.trim().toUpperCase();
}
