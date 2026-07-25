import { db } from "@/src/db";
import {
  assessmentRevisions,
  assessments,
  auditEvents,
  factOptions,
  organizationFactDefinitions,
  organizationFactValueOptions,
  organizationFactValues,
  organizationInvitations,
  organizationAiProviderPolicies,
  organizationMemberships,
  organizations,
  userDirectory,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import * as z from "zod";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { ApiError } from "../api/errors";
import {
  loadPublishedReleasesById,
  nextCachedRuntimeReleaseReader,
  type RuntimeReleaseReader,
} from "@/src/server/compliance";
import type {
  AcceptOrganizationInvitationInput,
  CreateOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitationDto,
  OrganizationDto,
  OrganizationFactDto,
  OrganizationInvitationDto,
  OrganizationMailboxInvitationDto,
  OrganizationListItem,
  OrganizationMemberDto,
  OrganizationRole,
  UpdateOrganizationInput,
} from "./types";
import {
  requireOrganizationCapability,
  resolveOrganizationCapabilities,
} from "../auth/capability-service";
import { organizationActionsForRole } from "./workflow-permissions";
import { getCursorCodec } from "../api/pagination";
import { defaultOrganizationAiProviderPolicy } from "../ai/grounding/provider-policy";

const dateCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
const nameCursorSchema = z.tuple([z.string(), z.uuid()]);

const assignableRoles: OrganizationRole[] = ["admin", "member", "auditor"];

export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationDto[]> {
  const rows = await db
    .select({ organization: organizations })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.status, "active"),
      isNull(organizations.archivedAt),
    ))
    .orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id))
    .limit(25);
  return rows.map((row) => row.organization);
}

export async function listOrganizationsForUserPage(input: {
  userId: string;
  status?: "active" | "archived";
  query?: string;
  limit: number;
  cursor?: string;
}) {
  const status = input.status ?? "active";
  const normalizedQuery = input.query?.trim().toLowerCase() ?? "";
  const scope = `organizations:${input.userId}:${status}:${normalizedQuery}`;
  const cursor = input.cursor
    ? nameCursorSchema.parse(getCursorCodec().decode(input.cursor, scope))
    : null;
  const normalizedName = sql<string>`lower(${organizations.name})`;
  const queryPattern = `%${normalizedQuery.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = await db.select({
    id: organizations.id,
    name: organizations.name,
    legalName: organizations.legalName,
    country: organizations.country,
    archivedAt: organizations.archivedAt,
    version: organizations.version,
    currentUserRole: organizationMemberships.role,
    activeMemberCount: sql<number>`(
      select count(*)::int
      from ${organizationMemberships} active_membership
      where active_membership.organization_id = ${organizations.id}
        and active_membership.status = 'active'
    )`,
  }).from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(and(
      eq(organizationMemberships.userId, input.userId),
      eq(organizationMemberships.status, "active"),
      status === "active" ? isNull(organizations.archivedAt) : isNotNull(organizations.archivedAt),
      normalizedQuery
        ? or(
            sql`lower(${organizations.name}) like ${queryPattern} escape '\\'`,
            sql`lower(coalesce(${organizations.legalName}, '')) like ${queryPattern} escape '\\'`,
          )
        : undefined,
      cursor
        ? or(
            gt(normalizedName, cursor[0]),
            and(eq(normalizedName, cursor[0]), gt(organizations.id, cursor[1])),
          )
        : undefined,
    ))
    .orderBy(asc(normalizedName), asc(organizations.id))
    .limit(input.limit + 1);
  const page: OrganizationListItem[] = rows.slice(0, input.limit).map((row) => ({
    ...row,
    allowedActions: organizationActionsForRole(row.currentUserRole, Boolean(row.archivedAt)),
  }));
  const last = page.at(-1);
  return {
    organizations: page,
    nextCursor:
      rows.length > input.limit && last
        ? getCursorCodec().encode(scope, [last.name.toLowerCase(), last.id])
        : undefined,
  };
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

    await tx.insert(organizationAiProviderPolicies).values({
      organizationId: organization.id,
      ...defaultOrganizationAiProviderPolicy,
      updatedBy: userId,
    });

    await tx.insert(auditEvents).values({
      organizationId: organization.id,
      actorUserId: userId,
      eventType: "organization.created",
      entityType: "organization",
      entityId: organization.id,
      metadata: {
        aiProviderPolicy: defaultOrganizationAiProviderPolicy,
      },
    });

    return organization;
  });
}

export async function updateOrganizationForUser(
  userId: string,
  organizationId: string,
  input: UpdateOrganizationInput,
  expectedVersion: number,
): Promise<OrganizationDto> {
  await assertCanManageOrganization(userId, organizationId);
  const name = normalizeRequiredString(input.name, "name");

  const [organization] = await db
    .update(organizations)
    .set({
      name,
      legalName: normalizeOptionalString(input.legalName),
      country: normalizeCountry(input.country),
      version: expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(organizations.id, organizationId), eq(organizations.version, expectedVersion)))
    .returning();

  if (!organization) {
    throw new ApiError(412, "The organization changed", undefined, "PRECONDITION_FAILED");
  }

  return organization;
}

export async function getOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationDto | null> {
  const membership = await db.query.organizationMemberships.findFirst({ columns: { id: true, organizationId: true, userId: true, role: true, status: true, version: true, createdAt: true, updatedAt: true },
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

export async function archiveOrganization(input: { userId: string; organizationId: string; expectedVersion: number }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "organizations:archive");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [organization] = await tx.update(organizations).set({
      archivedAt: now, version: input.expectedVersion + 1, updatedAt: now,
    }).where(and(eq(organizations.id, input.organizationId), eq(organizations.version, input.expectedVersion), isNull(organizations.archivedAt))).returning();
    if (!organization) throw new ApiError(412, "The organization changed", undefined, "PRECONDITION_FAILED");
    await tx.insert(auditEvents).values({ organizationId: organization.id, actorUserId: input.userId, eventType: "organization.archived", entityType: "organization", entityId: organization.id, metadata: { version: organization.version } });
    return organization;
  });
}

export async function restoreOrganization(input: { userId: string; organizationId: string; expectedVersion: number }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "organizations:archive");
  return db.transaction(async (tx) => {
    const [organization] = await tx.update(organizations).set({
      archivedAt: null, version: input.expectedVersion + 1, updatedAt: new Date(),
    }).where(and(eq(organizations.id, input.organizationId), eq(organizations.version, input.expectedVersion), isNotNull(organizations.archivedAt))).returning();
    if (!organization) throw new ApiError(412, "The organization changed", undefined, "PRECONDITION_FAILED");
    await tx.insert(auditEvents).values({ organizationId: organization.id, actorUserId: input.userId, eventType: "organization.restored", entityType: "organization", entityId: organization.id, metadata: { version: organization.version } });
    return organization;
  });
}

export async function listOrganizationMembers(userId: string, organizationId: string) {
  return (await listOrganizationMembersPage({ userId, organizationId, limit: 100 })).members;
}
export async function listOrganizationMembersPage(input: { userId: string; organizationId: string; limit: number; cursor?: string }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "members:read");
  const scope = `organization-members:${input.organizationId}`;
  const cursor = input.cursor ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.select({
    id: organizationMemberships.id,
    organizationId: organizationMemberships.organizationId,
    userId: organizationMemberships.userId,
    role: organizationMemberships.role,
    status: organizationMemberships.status,
    version: organizationMemberships.version,
    createdAt: organizationMemberships.createdAt,
    updatedAt: organizationMemberships.updatedAt,
    email: userDirectory.email,
    displayName: userDirectory.displayName,
  }).from(organizationMemberships)
    .leftJoin(userDirectory, eq(userDirectory.userId, organizationMemberships.userId))
    .where(and(eq(organizationMemberships.organizationId, input.organizationId), cursor ? or(gt(organizationMemberships.createdAt, new Date(cursor[0])), and(eq(organizationMemberships.createdAt, new Date(cursor[0])), gt(organizationMemberships.id, cursor[1]))) : undefined))
    .orderBy(asc(organizationMemberships.createdAt), asc(organizationMemberships.id))
    .limit(input.limit + 1);
  const members: OrganizationMemberDto[] = rows.slice(0, input.limit).map((row) => ({
    ...row,
    email: row.email ?? `member-${row.userId.slice(0, 8)}@unresolved.invalid`,
    displayName: row.displayName,
    identityResolved: Boolean(row.email),
  }));
  const last = members.at(-1);
  const authorization = await resolveOrganizationCapabilities(input.userId, input.organizationId);
  return {
    members,
    controls: {
      actorUserId: input.userId,
      canManage: authorization.capabilities.has("members:manage"),
      canManageOwners: authorization.capabilities.has("members:manage-owners"),
    },
    nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined,
  };
}

export async function updateOrganizationMember(input: {
  userId: string;
  organizationId: string;
  memberUserId: string;
  role: OrganizationRole;
  status: "active" | "suspended";
  expectedVersion: number;
}) {
  await requireOrganizationCapability(
    input.userId,
    input.organizationId,
    input.userId === input.memberUserId && input.status === "suspended" ? "organizations:read" : "members:manage",
  );
  const actorAuthorization = await resolveOrganizationCapabilities(input.userId, input.organizationId);
  return db.transaction(async (tx) => {
    // Serialize membership lifecycle changes for one organization. Without this
    // lock, two owners could each observe the other owner and concurrently
    // demote/leave, violating the final-owner invariant.
    const [lockedOrganization] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .for("update");
    if (!lockedOrganization) {
      throw new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
    }
    const current = await tx.query.organizationMemberships.findFirst({ columns: { id: true, organizationId: true, userId: true, role: true, status: true, version: true, createdAt: true, updatedAt: true },
      where: and(eq(organizationMemberships.organizationId, input.organizationId), eq(organizationMemberships.userId, input.memberUserId)),
    });
    if (!current) throw new ApiError(404, "Organization member not found", undefined, "MEMBER_NOT_FOUND");
    if (
      (current.role === "owner" || input.role === "owner") &&
      !actorAuthorization.capabilities.has("members:manage-owners")
    ) {
      throw new ApiError(403, "Only owners can manage organization owners", undefined, "CAPABILITY_REQUIRED");
    }
    if (
      current.role !== "owner" &&
      input.role === "owner" &&
      current.status !== "active"
    ) {
      throw new ApiError(
        409,
        "Only an active member can be promoted to owner",
        undefined,
        "OWNER_PROMOTION_REQUIRES_ACTIVE_MEMBER",
      );
    }
    if (current.role === "owner" && current.status === "active" && (input.role !== "owner" || input.status !== "active")) {
      const [owners] = await tx.select({ count: sql<number>`count(*)::int` }).from(organizationMemberships).where(and(
        eq(organizationMemberships.organizationId, input.organizationId), eq(organizationMemberships.role, "owner"),
        eq(organizationMemberships.status, "active"), ne(organizationMemberships.userId, input.memberUserId),
      ));
      if (owners.count < 1) throw new ApiError(409, "An organization must retain an active owner", undefined, "LAST_OWNER_REQUIRED");
    }
    const [member] = await tx.update(organizationMemberships).set({
      role: input.role, status: input.status, version: input.expectedVersion + 1, updatedAt: new Date(),
    }).where(and(eq(organizationMemberships.id, current.id), eq(organizationMemberships.version, input.expectedVersion))).returning();
    if (!member) throw new ApiError(412, "The membership changed", undefined, "PRECONDITION_FAILED");
    await tx.insert(auditEvents).values({ organizationId: input.organizationId, actorUserId: input.userId, eventType: "organization_member.updated", entityType: "organization_membership", entityId: member.id, metadata: { role: member.role, status: member.status } });
    return member;
  });
}

export async function leaveOrganization(input: { userId: string; organizationId: string; expectedVersion: number }) {
  const membership = await requireOrganizationCapability(input.userId, input.organizationId, "organizations:read");
  return updateOrganizationMember({
    userId: input.userId, organizationId: input.organizationId, memberUserId: input.userId,
    role: membership.role, status: "suspended", expectedVersion: input.expectedVersion,
  });
}

export async function setOrganizationMemberStatus(input: {
  userId: string; organizationId: string; memberUserId: string;
  status: "active" | "suspended"; expectedVersion: number;
}) {
  await requireOrganizationCapability(input.userId, input.organizationId, "members:manage");
  const current = await db.query.organizationMemberships.findFirst({ columns: { id: true, organizationId: true, userId: true, role: true, status: true, version: true, createdAt: true, updatedAt: true },
    where: and(eq(organizationMemberships.organizationId, input.organizationId), eq(organizationMemberships.userId, input.memberUserId)),
  });
  if (!current) throw new ApiError(404, "Organization member not found", undefined, "MEMBER_NOT_FOUND");
  return updateOrganizationMember({ ...input, role: current.role });
}

export async function listCurrentOrganizationFactsForUser(
  userId: string,
  organizationId: string,
  locale: Locale,
  dependencies: { runtimeReleaseReader?: RuntimeReleaseReader } = {},
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
  const releases = await loadPublishedReleasesById(
    dependencies.runtimeReleaseReader ?? nextCachedRuntimeReleaseReader,
    rows.flatMap((row) =>
      row.checkReleaseId ? [row.checkReleaseId] : [],
    ),
    locale,
  );
  const optionsByValueId = new Map<string, string[]>();
  for (const option of optionRows) {
    const values = optionsByValueId.get(option.valueId) ?? [];
    values.push(option.stableValue);
    optionsByValueId.set(option.valueId, values);
  }
  const result: OrganizationFactDto[] = [];
  for (const row of rows) {
    const release = row.checkReleaseId
      ? releases.get(row.checkReleaseId)
      : undefined;
    const questionIndex = release?.questionIndexByFactKey[row.value.factKey];
    const question = questionIndex === undefined
      ? undefined
      : release?.questions[questionIndex];
    const stableValues = optionsByValueId.get(row.value.id) ?? [];
    const labels = stableValues.map((stableValue) => {
      if (!release || !question) return stableValue;
      const optionIndex = release.optionIndexByQuestionAndValue[
        `${question.id}\u0000${stableValue}`
      ];
      return optionIndex
        ? release.questions[optionIndex.questionIndex]?.options[
            optionIndex.optionIndex
          ]?.label ?? stableValue
        : stableValue;
    });
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
  return (await listOrganizationInvitationsPage({ userId, organizationId, limit: 100 })).invitations;
}

export async function listOrganizationInvitationsPage(input: { userId: string; organizationId: string; limit: number; cursor?: string }) {
  await assertCanManageOrganization(input.userId, input.organizationId);
  const scope = `organization-invitations:${input.organizationId}`;
  const cursor = input.cursor ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.organizationInvitations.findMany({ columns: { id: true, organizationId: true, email: true, role: true, invitedByUserId: true, acceptedByUserId: true, tokenHash: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true, updatedAt: true }, where: and(eq(organizationInvitations.organizationId, input.organizationId), cursor ? or(lt(organizationInvitations.createdAt, new Date(cursor[0])), and(eq(organizationInvitations.createdAt, new Date(cursor[0])), lt(organizationInvitations.id, cursor[1]))) : undefined), orderBy: [desc(organizationInvitations.createdAt), desc(organizationInvitations.id)], limit: input.limit + 1 });
  const page = rows.slice(0, input.limit); const last = page.at(-1);
  return { invitations: page.map(toInvitationDto), nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined };
}

export async function listMailboxInvitationsForUser(
  user: User,
): Promise<OrganizationMailboxInvitationDto[]> {
  return (await listMailboxInvitationsForUserPage({ user, limit: 100 })).invitations;
}

export async function listMailboxInvitationsForUserPage(input: { user: User; limit: number; cursor?: string }) {
  const { user } = input;
  if (!user.email) {
    return { invitations: [], nextCursor: undefined };
  }
  const scope = `invitation-mailbox:${user.id}`;
  const cursor = input.cursor ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.organizationInvitations.findMany({ columns: { id: true, organizationId: true, email: true, role: true, invitedByUserId: true, acceptedByUserId: true, tokenHash: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true, updatedAt: true },
    where: and(
      eq(organizationInvitations.email, normalizeEmail(user.email)),
      eq(organizationInvitations.status, "pending"),
      cursor ? or(lt(organizationInvitations.createdAt, new Date(cursor[0])), and(eq(organizationInvitations.createdAt, new Date(cursor[0])), lt(organizationInvitations.id, cursor[1]))) : undefined,
    ),
    with: {
      organization: true,
    },
    orderBy: [desc(organizationInvitations.createdAt), desc(organizationInvitations.id)],
    limit: input.limit + 1,
  });
  const page = rows.slice(0, input.limit);
  const invitations = page.map((invitation) => ({
    ...toInvitationDto(invitation),
    organization: invitation.organization,
  }));
  const last = page.at(-1);
  return { invitations, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.id]) : undefined };
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
  const invitation = await db.query.organizationInvitations.findFirst({ columns: { id: true, organizationId: true, email: true, role: true, invitedByUserId: true, acceptedByUserId: true, tokenHash: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true, updatedAt: true },
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
  const invitation = await db.query.organizationInvitations.findFirst({ columns: { id: true, organizationId: true, email: true, role: true, invitedByUserId: true, acceptedByUserId: true, tokenHash: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true, updatedAt: true },
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
  return requireOrganizationCapability(userId, organizationId, "organizations:read");
}

export async function getOrganizationInvitation(userId: string, organizationId: string, invitationId: string) {
  await requireOrganizationCapability(userId, organizationId, "members:read");
  const invitation = await db.query.organizationInvitations.findFirst({ columns: { id: true, organizationId: true, email: true, role: true, invitedByUserId: true, acceptedByUserId: true, tokenHash: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true, updatedAt: true }, where: and(
    eq(organizationInvitations.id, invitationId), eq(organizationInvitations.organizationId, organizationId),
  ) });
  if (!invitation) throw new ApiError(404, "Invitation not found", undefined, "INVITATION_NOT_FOUND");
  return toInvitationDto(invitation);
}

export async function revokeOrganizationInvitation(input: { userId: string; organizationId: string; invitationId: string }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "members:invite");
  const [invitation] = await db.update(organizationInvitations).set({ status: "revoked", updatedAt: new Date() }).where(and(
    eq(organizationInvitations.id, input.invitationId), eq(organizationInvitations.organizationId, input.organizationId),
    eq(organizationInvitations.status, "pending"),
  )).returning();
  if (!invitation) throw new ApiError(409, "Only a pending invitation can be revoked", undefined, "INVITATION_NOT_PENDING");
  return toInvitationDto(invitation);
}

export async function resendOrganizationInvitation(input: { userId: string; organizationId: string; invitationId: string }) {
  await requireOrganizationCapability(input.userId, input.organizationId, "members:invite");
  const invitation = await db.query.organizationInvitations.findFirst({ columns: { id: true, organizationId: true, email: true, role: true, invitedByUserId: true, acceptedByUserId: true, tokenHash: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true, updatedAt: true }, where: and(
    eq(organizationInvitations.id, input.invitationId), eq(organizationInvitations.organizationId, input.organizationId),
  ) });
  if (!invitation || invitation.status === "accepted") throw new ApiError(409, "Invitation cannot be resent", undefined, "INVITATION_NOT_RESENDABLE");
  return createOrganizationInvitation(input.userId, input.organizationId, {
    email: invitation.email, role: invitation.role === "owner" ? "admin" : invitation.role, expiresInDays: 14,
  });
}

export async function assertCanManageOrganization(
  userId: string,
  organizationId: string,
) {
  return requireOrganizationCapability(userId, organizationId, "plans:manage");
}

export async function assertCanContributeToOrganization(
  userId: string,
  organizationId: string,
) {
  return requireOrganizationCapability(userId, organizationId, "plans:contribute");
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
