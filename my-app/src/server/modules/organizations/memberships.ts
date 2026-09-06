import { auditEvents, organizationMemberships, organizations, userProfiles } from "@/src/db/schema";
import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { getCursorCodec } from "../../platform/http/pagination";
import { hasOrganizationCapability } from "../../platform/auth/capabilities";
import { authorizeOrganizationRead, withAuthorizedOrganizationCommand, type OrganizationTransaction } from "../../platform/auth/organization-scope";
import type { OrganizationMemberDto, OrganizationRole } from "./types";
import { dateCursorSchema } from "./queries";
import type { Transaction } from "./invitations";
import { organizationNotFound } from "./lifecycle";

export const assignableRoles: OrganizationRole[] = ["contributor", "viewer"];

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

export async function deleteMembership(
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

export async function findMembership(
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

export async function assertAnotherOwner(
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

export function memberNotFound() {
  return new ApiError(404, "Member not found", undefined, "MEMBER_NOT_FOUND");
}
