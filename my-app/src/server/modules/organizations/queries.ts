import * as z from "zod";
import { db } from "@/src/db";
import { organizationMemberships, organizations } from "@/src/db/schema";
import { and, asc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getCursorCodec } from "../../platform/http/pagination";
import { authorizeOrganizationRead } from "../../platform/auth/organization-scope";
import { organizationActionsForRole } from "./workflow-permissions";
import type { OrganizationDto, OrganizationListItem } from "./types";
import { organizationNotFound } from "./lifecycle";

export const dateCursorSchema = z.tuple([z.iso.datetime(), z.uuid()]);

export const nameCursorSchema = z.tuple([z.string(), z.uuid()]);

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

export async function assertCanAccessOrganization(userId: string, organizationId: string) {
  return (await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "organizations:read" })).membership;
}

export async function assertCanManageOrganization(userId: string, organizationId: string) {
  return (await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "plans:manage" })).membership;
}

export async function assertCanContributeToOrganization(userId: string, organizationId: string) {
  return (await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "plans:contribute" })).membership;
}
