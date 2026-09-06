import { db, type Db } from "@/src/db";
import { organizationMemberships, organizations } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import type { OrganizationCapability } from "./capabilities";
import { requireOrganizationCapability } from "./capability-service";

export type OrganizationScopeExecutor =
  | Db
  | Parameters<Parameters<Db["transaction"]>[0]>[0];
export type OrganizationTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AuthorizedOrganizationScope = Readonly<{
  actorUserId: string;
  organizationId: string;
  capability: OrganizationCapability;
  membership: Readonly<{
    organizationId: string;
    userId: string;
    role: "owner" | "contributor" | "viewer";
    createdAt: Date;
  }>;
  executor: OrganizationScopeExecutor;
}>;

export type AuthorizedOrganizationCommandScope = Readonly<
  Omit<AuthorizedOrganizationScope, "executor"> & {
    executor: OrganizationTransaction;
  }
>;

type ScopeInput = Readonly<{
  actorUserId: string;
  organizationId: string;
  capability: OrganizationCapability;
}>;

/** Authorizes one read boundary and pins every query to the supplied executor. */
export async function authorizeOrganizationRead(
  input: ScopeInput,
  executor: OrganizationScopeExecutor = db,
): Promise<AuthorizedOrganizationScope> {
  const membership = await requireOrganizationCapability(
    input.actorUserId,
    input.organizationId,
    input.capability,
    executor,
  );
  return freezeScope(input, membership, executor);
}

/**
 * Runs authorization and an organization command in the same transaction.
 * The organization and actor membership rows are locked before capability and
 * archive policy are evaluated, so archive/removal cannot pass the check and
 * race a later write.
 */
export function withAuthorizedOrganizationCommand<T>(
  input: ScopeInput,
  command: (scope: AuthorizedOrganizationCommandScope) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .for("update");
    await tx
      .select({ organizationId: organizationMemberships.organizationId })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, input.organizationId),
          eq(organizationMemberships.userId, input.actorUserId),
        ),
      )
      .for("update");

    const scope = await authorizeOrganizationRead(input, tx);
    return command(scope as AuthorizedOrganizationCommandScope);
  });
}

function freezeScope(
  input: ScopeInput,
  membership: AuthorizedOrganizationScope["membership"],
  executor: OrganizationScopeExecutor,
): AuthorizedOrganizationScope {
  return Object.freeze({
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    capability: input.capability,
    membership: Object.freeze({ ...membership }),
    executor,
  });
}
