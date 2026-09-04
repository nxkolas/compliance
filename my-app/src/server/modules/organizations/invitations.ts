import { createHash, randomBytes } from "node:crypto";
import { db } from "@/src/db";
import { auditEvents, organizationInvitations, organizationMemberships, organizations } from "@/src/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";
import type { AuthenticatedActor } from "@/src/server/platform/auth/user-projection";
import type { AcceptOrganizationInvitationInput, CreateOrganizationInvitationInput, CreatedOrganizationInvitationDto, OrganizationInvitationDto, OrganizationMailboxInvitationDto } from "./types";
import { assignableRoles } from "./memberships";

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

export async function acceptInvitationRow(
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

export async function deleteExpiredInvitations(organizationId?: string, executor: OrganizationScopeExecutor = db) {
  await executor
    .delete(organizationInvitations)
    .where(and(sql`${organizationInvitations.expiresAt} <= now()`, organizationId ? eq(organizationInvitations.organizationId, organizationId) : undefined));
}

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function withoutTokenHash(
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

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationNotFound() {
  return new ApiError(404, "Invitation not found", undefined, "INVITATION_NOT_FOUND");
}
