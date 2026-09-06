import { eq, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db } from "@/src/db";
import { userProfiles } from "@/src/db/schema";
import {
  projectActorDirectoryIdentity,
  projectAuthenticatedActor,
  type AuthenticatedActor,
} from "./user-projection";
export {
  projectAuthenticatedActor,
  projectAuthenticatedUser,
} from "./user-projection";

export async function synchronizeAuthenticatedActor(actor: AuthenticatedActor) {
  const identity = projectActorDirectoryIdentity(actor);
  if (!identity) return null;

  const current = await db.query.userProfiles.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.userId, identity.userId) ?? operators.sql`true`,
    },
  });
  if (
    current &&
    current.email === identity.email &&
    current.displayName === identity.displayName
  ) {
    return current;
  }

  const [row] = await db
    .insert(userProfiles)
    .values(identity)
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { email: identity.email, displayName: identity.displayName },
      setWhere: sql`${userProfiles.email} is distinct from excluded.email
        or ${userProfiles.displayName} is distinct from excluded.display_name`,
    })
    .returning();
  return row ?? db.query.userProfiles.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.userId, identity.userId) ?? operators.sql`true`,
    },
  });
}

export async function syncAuthenticatedUser(user: User) {
  return synchronizeAuthenticatedActor(projectAuthenticatedActor(user));
}
