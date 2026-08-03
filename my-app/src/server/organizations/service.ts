import { createHash, randomBytes } from "node:crypto";
import * as z from "zod";
import { db } from "@/src/db";
import {
  auditEvents,
  organizationInvitations,
  organizationMemberships,
  organizations,
  userProfiles,
} from "@/src/db/schema";
import {
  and,
  asc,
  eq,
  gt,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { ApiError } from "../api/errors";
import { getCursorCodec } from "../api/pagination";
import { hasOrganizationCapability } from "../auth/capabilities";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand, type OrganizationScopeExecutor, type OrganizationTransaction } from "../auth/organization-scope";
import { organizationActionsForRole } from "./workflow-permissions";
import type { AuthenticatedActor } from "@/src/server/users/projection";
import type {
  AcceptOrganizationInvitationInput,
  CreateOrganizationInput,
  CreateOrganizationInvitationInput,
  CreatedOrganizationInvitationDto,
  OrganizationDto,
  OrganizationInvitationDto,
  OrganizationListItem,
  OrganizationMailboxInvitationDto,
  OrganizationMemberDto,
  OrganizationRole,
  UpdateOrganizationInput,
} from "./types";

const dateCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);
const nameCursorSchema = z.tuple([z.string(), z.uuid()]);
const assignableRoles: OrganizationRole[] = ["contributor", "viewer"];

export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationDto[]> {
  const rows = await db
    .select({ organization: organizations })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        isNull(organizations.archivedAt),
      ),
    )
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
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      legalName: organizations.legalName,
      countryCode: organizations.countryCode,
      aiProviderMode: organizations.aiProviderMode,
      archivedAt: organizations.archivedAt,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      currentUserRole: organizationMemberships.role,
      activeMemberCount: sql<number>`(
        select count(*)::int from ${organizationMemberships} membership_count
        where membership_count.organization_id = ${organizations.id}
      )`,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMemberships.userId, input.userId),
        status === "active"
          ? isNull(organizations.archivedAt)
          : isNotNull(organizations.archivedAt),
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
      ),
    )
    .orderBy(asc(normalizedName), asc(organizations.id))
    .limit(input.limit + 1);

  const page: OrganizationListItem[] = rows.slice(0, input.limit).map((row) => ({
    ...row,
    allowedActions: organizationActionsForRole(
      row.currentUserRole,
      Boolean(row.archivedAt),
    ),
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
  return db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        name: normalizeRequiredString(input.name, "name"),
        legalName: normalizeOptionalString(input.legalName),
        countryCode: normalizeCountry(input.countryCode),
        aiProviderMode: input.aiProviderMode,
      })
      .returning();
    if (!organization) throw new Error("Organization insert returned no row");

    await tx.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId,
      role: "owner",
    });
    await tx.insert(auditEvents).values({
      organizationId: organization.id,
      actorUserId: userId,
      eventType: "organization.created",
      entityType: "organization",
      entityId: organization.id,
      metadata: {
        countryCode: organization.countryCode,
        aiProviderMode: organization.aiProviderMode,
      },
    });
    return organization;
  });
}

export async function updateOrganizationForUser(
  userId: string,
  organizationId: string,
  input: UpdateOrganizationInput,
) {
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "organizations:update" }, async ({ executor }) => {
    const [organization] = await executor
      .update(organizations)
      .set({
        name: normalizeRequiredString(input.name, "name"),
        legalName: normalizeOptionalString(input.legalName),
        countryCode: normalizeCountry(input.countryCode),
        aiProviderMode: input.aiProviderMode,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();
    if (!organization) throw organizationNotFound();
    await executor.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      eventType: "organization.updated",
      entityType: "organization",
      entityId: organizationId,
      metadata: {
        countryCode: organization.countryCode,
        aiProviderMode: organization.aiProviderMode,
      },
    });
    return organization;
  });
}

export async function getOrganizationForUser(
  userId: string,
  organizationId: string,
) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" });
  const organization = await executor.query.organizations.findFirst({
    columns: {
      id: true,
      name: true,
      legalName: true,
      countryCode: true,
      aiProviderMode: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, organizationId) ?? operators.sql`true`,
    },
  });
  if (!organization) throw organizationNotFound();
  return organization;
}

export async function archiveOrganization(input: {
  userId: string;
  organizationId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:archive" }, ({ executor }) => setOrganizationArchiveState(input, new Date(), "organization.archived", executor));
}

export async function restoreOrganization(input: {
  userId: string;
  organizationId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:archive" }, ({ executor }) => setOrganizationArchiveState(input, null, "organization.restored", executor));
}

async function setOrganizationArchiveState(
  input: { userId: string; organizationId: string },
  archivedAt: Date | null,
  eventType: string,
  executor: OrganizationTransaction,
) {
    const [organization] = await executor
      .update(organizations)
      .set({ archivedAt, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning();
    if (!organization) throw organizationNotFound();
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType,
      entityType: "organization",
      entityId: input.organizationId,
      metadata: {},
    });
    return organization;
}

export async function listOrganizationMembers(
  userId: string,
  organizationId: string,
) {
  return (
    await listOrganizationMembersPage({
      userId,
      organizationId,
      limit: 100,
    })
  ).members;
}

export async function listOrganizationMembersPage(input: {
  userId: string;
  organizationId: string;
  limit: number;
  cursor?: string;
}) {
  const authorization = await authorizeOrganizationRead({ actorUserId: input.userId, organizationId: input.organizationId, capability: "members:read" });
  const db = authorization.executor;
  const scope = `organization-members:${input.organizationId}`;
  const cursor = input.cursor
    ? dateCursorSchema.parse(getCursorCodec().decode(input.cursor, scope))
    : null;
  const rows = await db
    .select({
      organizationId: organizationMemberships.organizationId,
      userId: organizationMemberships.userId,
      role: organizationMemberships.role,
      createdAt: organizationMemberships.createdAt,
      email: userProfiles.email,
      displayName: userProfiles.displayName,
    })
    .from(organizationMemberships)
    .leftJoin(userProfiles, eq(userProfiles.userId, organizationMemberships.userId))
    .where(
      and(
        eq(organizationMemberships.organizationId, input.organizationId),
        cursor
          ? or(
              gt(organizationMemberships.createdAt, new Date(cursor[0])),
              and(
                eq(organizationMemberships.createdAt, new Date(cursor[0])),
                gt(organizationMemberships.userId, cursor[1]),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(organizationMemberships.createdAt), asc(organizationMemberships.userId))
    .limit(input.limit + 1);
  const members: OrganizationMemberDto[] = rows.slice(0, input.limit).map((row) => ({
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role,
    createdAt: row.createdAt,
    email: row.email ?? "",
    displayName: row.displayName,
    identityResolved: row.email !== null,
  }));
  const last = members.at(-1);
  return {
    members,
    controls: {
      actorUserId: input.userId,
      canManage: hasOrganizationCapability(authorization.membership.role, "members:manage"),
      canManageOwners: authorization.membership.role === "owner",
    },
    nextCursor:
      rows.length > input.limit && last
        ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.userId])
        : undefined,
  };
}

export async function updateOrganizationMember(input: {
  userId: string;
  organizationId: string;
  memberUserId: string;
  role: OrganizationRole;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "members:manage" }, async ({ executor }) => {
    const current = await findMembership(executor, input.organizationId, input.memberUserId);
    if (!current) throw memberNotFound();
    if (current.role === "owner" && input.role !== "owner") {
      await assertAnotherOwner(executor, input.organizationId, input.memberUserId);
    }
    const [membership] = await executor
      .update(organizationMemberships)
      .set({ role: input.role })
      .where(
        and(
          eq(organizationMemberships.organizationId, input.organizationId),
          eq(organizationMemberships.userId, input.memberUserId),
        ),
      )
      .returning();
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "membership.role_changed",
      entityType: "membership",
      entityId: input.memberUserId,
      metadata: { previousRole: current.role, role: input.role },
    });
    return membership!;
  });
}

export async function removeOrganizationMember(input: {
  userId: string;
  organizationId: string;
  memberUserId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "members:manage" }, ({ executor }) => deleteMembership(input, "membership.removed", executor));
}

export async function leaveOrganization(input: {
  userId: string;
  organizationId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "organizations:read" }, ({ executor }) => deleteMembership({ ...input, memberUserId: input.userId }, "membership.left", executor));
}

async function deleteMembership(
  input: { userId: string; organizationId: string; memberUserId: string },
  eventType: string,
  executor: OrganizationTransaction,
) {
    const current = await findMembership(executor, input.organizationId, input.memberUserId);
    if (!current) throw memberNotFound();
    if (current.role === "owner") {
      await assertAnotherOwner(executor, input.organizationId, input.memberUserId);
    }
    await executor
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, input.organizationId),
          eq(organizationMemberships.userId, input.memberUserId),
        ),
      );
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType,
      entityType: "membership",
      entityId: input.memberUserId,
      metadata: { previousRole: current.role },
    });
    return current;
}

export async function listOrganizationInvitations(
  userId: string,
  organizationId: string,
) {
  return (
    await listOrganizationInvitationsPage({ userId, organizationId, limit: 100 })
  ).invitations;
}

export async function listOrganizationInvitationsPage(input: {
  userId: string;
  organizationId: string;
  limit: number;
  cursor?: string;
}) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: input.userId, organizationId: input.organizationId, capability: "members:read" });
  await deleteExpiredInvitations(input.organizationId, executor);
  const rows = await executor.query.organizationInvitations.findMany({
    columns: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      invitedBy: true,
      expiresAt: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, input.organizationId) ?? operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
    limit: input.limit,
  });
  return { invitations: rows, nextCursor: undefined };
}

export async function listMailboxInvitationsForUser(user: AuthenticatedActor) {
  return (
    await listMailboxInvitationsForUserPage({ user, limit: 100 })
  ).invitations;
}

export async function listMailboxInvitationsForUserPage(input: {
  user: AuthenticatedActor;
  limit: number;
  cursor?: string;
}) {
  const email = input.user.email;
  if (!email) return { invitations: [], nextCursor: undefined };
  await deleteExpiredInvitations();
  const rows = await db
    .select({ invitation: organizationInvitations, organization: organizations })
    .from(organizationInvitations)
    .innerJoin(
      organizations,
      eq(organizationInvitations.organizationId, organizations.id),
    )
    .where(eq(sql`lower(${organizationInvitations.email})`, email))
    .orderBy(asc(organizationInvitations.createdAt))
    .limit(input.limit);
  const invitations: OrganizationMailboxInvitationDto[] = rows.map((row) => ({
    ...withoutTokenHash(row.invitation),
    organization: row.organization,
  }));
  return { invitations, nextCursor: undefined };
}

export async function createOrganizationInvitation(
  userId: string,
  organizationId: string,
  input: CreateOrganizationInvitationInput,
): Promise<CreatedOrganizationInvitationDto> {
  if (!assignableRoles.includes(input.role)) {
    throw new ApiError(400, "Invitation role is not assignable", undefined, "INVALID_ROLE");
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "members:invite" }, async ({ executor }) => {
    await executor
      .delete(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(sql`lower(${organizationInvitations.email})`, input.email.toLowerCase()),
        ),
      );
    const [invitation] = await executor
      .insert(organizationInvitations)
      .values({
        organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: hashToken(token),
        invitedBy: userId,
        expiresAt,
      })
      .returning();
    if (!invitation) throw new Error("Invitation insert returned no row");
    await executor.insert(auditEvents).values({
      organizationId,
      actorUserId: userId,
      eventType: "invitation.created",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role, expiresAt },
    });
    return { ...withoutTokenHash(invitation), token };
  });
}

export async function acceptOrganizationInvitation(
  user: AuthenticatedActor,
  input: AcceptOrganizationInvitationInput,
) {
  const invitation = await db.query.organizationInvitations.findFirst({
    columns: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      tokenHash: true,
      invitedBy: true,
      expiresAt: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.tokenHash, hashToken(input.token)) ?? operators.sql`true`,
    },
  });
  if (!invitation) throw invitationNotFound();
  return acceptInvitationRow(user, invitation);
}

export async function acceptMailboxInvitation(user: AuthenticatedActor, invitationId: string) {
  const invitation = await db.query.organizationInvitations.findFirst({
    columns: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      tokenHash: true,
      invitedBy: true,
      expiresAt: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, invitationId) ?? operators.sql`true`,
    },
  });
  if (!invitation) throw invitationNotFound();
  return acceptInvitationRow(user, invitation);
}

async function acceptInvitationRow(
  user: AuthenticatedActor,
  invitation: typeof organizationInvitations.$inferSelect,
) {
  if (!user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ApiError(403, "Invitation email does not match", undefined, "INVITATION_EMAIL_MISMATCH");
  }
  if (invitation.expiresAt <= new Date()) {
    await db.delete(organizationInvitations).where(eq(organizationInvitations.id, invitation.id));
    throw new ApiError(410, "Invitation expired", undefined, "INVITATION_EXPIRED");
  }
  return db.transaction(async (tx) => {
    await tx.insert(organizationMemberships).values({
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role,
    });
    await tx.delete(organizationInvitations).where(eq(organizationInvitations.id, invitation.id));
    await tx.insert(auditEvents).values({
      organizationId: invitation.organizationId,
      actorUserId: user.id,
      eventType: "invitation.accepted",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });
    return withoutTokenHash(invitation);
  });
}

export async function getOrganizationInvitation(
  userId: string,
  organizationId: string,
  invitationId: string,
) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "members:read" });
  const invitation = await executor.query.organizationInvitations.findFirst({
    columns: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      invitedBy: true,
      expiresAt: true,
      createdAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(eq(table.id, invitationId), eq(table.organizationId, organizationId)) ??
        operators.sql`true`,
    },
  });
  if (!invitation) throw invitationNotFound();
  return invitation;
}

export async function revokeOrganizationInvitation(input: {
  userId: string;
  organizationId: string;
  invitationId: string;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "members:invite" }, async ({ executor }) => {
    const [invitation] = await executor
      .delete(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.id, input.invitationId),
          eq(organizationInvitations.organizationId, input.organizationId),
        ),
      )
      .returning();
    if (!invitation) throw invitationNotFound();
    await executor.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "invitation.revoked",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email },
    });
    return withoutTokenHash(invitation);
  });
}

export async function resendOrganizationInvitation(input: {
  userId: string;
  organizationId: string;
  invitationId: string;
}) {
  const invitation = await getOrganizationInvitation(
    input.userId,
    input.organizationId,
    input.invitationId,
  );
  if (invitation.role === "owner") {
    throw new ApiError(409, "Owners cannot be invited", undefined, "INVALID_ROLE");
  }
  return createOrganizationInvitation(input.userId, input.organizationId, {
    email: invitation.email,
    role: invitation.role,
  });
}

export async function assertCanAccessOrganization(userId: string, organizationId: string) {
  return (await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" })).membership;
}
export async function assertCanManageOrganization(userId: string, organizationId: string) {
  return (await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "plans:manage" })).membership;
}
export async function assertCanContributeToOrganization(userId: string, organizationId: string) {
  return (await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "plans:contribute" })).membership;
}

async function deleteExpiredInvitations(organizationId?: string, executor: OrganizationScopeExecutor = db) {
  await executor
    .delete(organizationInvitations)
    .where(and(sql`${organizationInvitations.expiresAt} <= now()`, organizationId ? eq(organizationInvitations.organizationId, organizationId) : undefined));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function findMembership(
  tx: Transaction,
  organizationId: string,
  userId: string,
) {
  return tx.query.organizationMemberships.findFirst({
    columns: { organizationId: true, userId: true, role: true, createdAt: true },
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.userId, userId)) ??
        operators.sql`true`,
    },
  });
}

async function assertAnotherOwner(
  tx: Transaction,
  organizationId: string,
  excludedUserId: string,
) {
  const [organization] = await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)
    .for("update");
  if (!organization) throw organizationNotFound();
  const owners = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.role, "owner"),
        sql`${organizationMemberships.userId} <> ${excludedUserId}`,
      ),
    );
  if ((owners[0]?.count ?? 0) < 1) {
    throw new ApiError(
      409,
      "At least one Owner must remain",
      undefined,
      "FINAL_OWNER_REQUIRED",
    );
  }
}

function withoutTokenHash(
  invitation: typeof organizationInvitations.$inferSelect,
): OrganizationInvitationDto {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role as "contributor" | "viewer",
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeRequiredString(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, `${field} is required`, undefined, "VALIDATION_ERROR");
  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCountry(value: string) {
  return value.trim().toUpperCase();
}

function organizationNotFound() {
  return new ApiError(404, "Organization not found", undefined, "ORGANIZATION_NOT_FOUND");
}

function memberNotFound() {
  return new ApiError(404, "Member not found", undefined, "MEMBER_NOT_FOUND");
}

function invitationNotFound() {
  return new ApiError(404, "Invitation not found", undefined, "INVITATION_NOT_FOUND");
}
