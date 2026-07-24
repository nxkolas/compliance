import { db } from "@/src/db";
import { platformAdministrators, platformAuditEvents } from "@/src/db/schema";
import { requirePlatformCapability } from "@/src/server/auth/capability-service";
import { and, asc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import * as z from "zod";
import { ApiError } from "../api/errors";
import { getCursorCodec } from "../api/pagination";

type GrantInput = {
  userId: string;
  actorUserId: string | null;
  reason: string;
  requestId?: string;
  operatorBootstrap?: boolean;
};

export async function grantPlatformAdministrator(input: GrantInput) {
  if (!input.operatorBootstrap) {
    if (!input.actorUserId) throw new ApiError(401, "Authentication required");
    await requirePlatformCapability(input.actorUserId, "platform-admins:manage");
  }
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "A grant reason is required", undefined, "GRANT_REASON_REQUIRED");

  return db.transaction(async (tx) => {
    await lockAdministratorRegistry(tx);
    const [administrator] = await tx
      .insert(platformAdministrators)
      .values({
        userId: input.userId,
        grantedByUserId: input.actorUserId,
        grantReason: reason,
      })
      .onConflictDoUpdate({
        target: platformAdministrators.userId,
        set: {
          grantedByUserId: input.actorUserId,
          grantReason: reason,
          revokedAt: null,
          revokedByUserId: null,
          revokeReason: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: input.operatorBootstrap
        ? "platform_administrator.bootstrapped"
        : "platform_administrator.granted",
      entityType: "platform_administrator",
      entityId: input.userId,
      requestId: input.requestId,
      metadata: { reason },
    });
    return administrator;
  });
}

export async function revokePlatformAdministrator(input: {
  userId: string;
  actorUserId: string;
  reason: string;
  requestId?: string;
}) {
  await requirePlatformCapability(input.actorUserId, "platform-admins:manage");
  const reason = input.reason.trim();
  if (!reason) throw new ApiError(400, "A revocation reason is required", undefined, "REVOCATION_REASON_REQUIRED");
  if (input.userId === input.actorUserId) {
    throw new ApiError(409, "Administrators cannot revoke themselves", undefined, "PLATFORM_ADMIN_SELF_REVOKE");
  }

  return db.transaction(async (tx) => {
    await lockAdministratorRegistry(tx);
    const actor = await tx.query.platformAdministrators.findFirst({ columns: { id: true, userId: true, grantedByUserId: true, grantReason: true, revokedByUserId: true, revokeReason: true, revokedAt: true, createdAt: true, updatedAt: true },
      where: and(
        eq(platformAdministrators.userId, input.actorUserId),
        isNull(platformAdministrators.revokedAt),
      ),
    });
    if (!actor) {
      throw new ApiError(403, "Platform Administrator access required", undefined, "PLATFORM_CAPABILITY_REQUIRED");
    }
    const [remaining] = await tx.select({ count: sql<number>`count(*)::int` })
      .from(platformAdministrators)
      .where(and(
        isNull(platformAdministrators.revokedAt),
        ne(platformAdministrators.userId, input.userId),
      ));
    if (remaining.count < 1) {
      throw new ApiError(409, "At least one active Platform Administrator is required", undefined, "LAST_PLATFORM_ADMIN_REQUIRED");
    }
    const [administrator] = await tx
      .update(platformAdministrators)
      .set({
        revokedAt: new Date(),
        revokedByUserId: input.actorUserId,
        revokeReason: reason,
        updatedAt: new Date(),
      })
      .where(and(
        eq(platformAdministrators.userId, input.userId),
        isNull(platformAdministrators.revokedAt),
      ))
      .returning();
    if (!administrator) {
      throw new ApiError(404, "Platform Administrator not found", undefined, "PLATFORM_ADMIN_NOT_FOUND");
    }

    await tx.insert(platformAuditEvents).values({
      actorUserId: input.actorUserId,
      eventType: "platform_administrator.revoked",
      entityType: "platform_administrator",
      entityId: input.userId,
      requestId: input.requestId,
      metadata: { reason },
    });
    return administrator;
  });
}

async function lockAdministratorRegistry(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('platform_administrators.lifecycle'))`);
}

export async function listActivePlatformAdministrators(actorUserId: string) {
  return (await listActivePlatformAdministratorsPage({ actorUserId, limit: 100 })).administrators;
}

export async function getPlatformAdministrator(actorUserId: string, userId: string) {
  await requirePlatformCapability(actorUserId, "platform-admins:manage");
  const administrator = await db.query.platformAdministrators.findFirst({ columns: { id: true, userId: true, grantedByUserId: true, grantReason: true, revokedByUserId: true, revokeReason: true, revokedAt: true, createdAt: true, updatedAt: true }, where: eq(platformAdministrators.userId, userId) });
  if (!administrator) throw new ApiError(404, "Platform Administrator not found", undefined, "PLATFORM_ADMIN_NOT_FOUND");
  return administrator;
}

export async function listActivePlatformAdministratorsPage(input: { actorUserId: string; limit: number; cursor?: string }) {
  await requirePlatformCapability(input.actorUserId, "platform-admins:manage");
  const scope = "platform-administrators:active";
  const cursor = input.cursor ? z.tuple([z.iso.datetime(), z.uuid()]).parse(getCursorCodec().decode(input.cursor, scope)) : null;
  const rows = await db.query.platformAdministrators.findMany({ columns: { id: true, userId: true, grantedByUserId: true, grantReason: true, revokedByUserId: true, revokeReason: true, revokedAt: true, createdAt: true, updatedAt: true },
    where: and(isNull(platformAdministrators.revokedAt), cursor ? or(gt(platformAdministrators.createdAt, new Date(cursor[0])), and(eq(platformAdministrators.createdAt, new Date(cursor[0])), gt(platformAdministrators.userId, cursor[1]))) : undefined),
    orderBy: [asc(platformAdministrators.createdAt), asc(platformAdministrators.userId)],
    limit: input.limit + 1,
  });
  const administrators = rows.slice(0, input.limit); const last = administrators.at(-1);
  return { administrators, nextCursor: rows.length > input.limit && last ? getCursorCodec().encode(scope, [last.createdAt.toISOString(), last.userId]) : undefined };
}
