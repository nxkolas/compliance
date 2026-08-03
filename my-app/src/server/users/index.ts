import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db } from "@/src/db";
import { userProfiles } from "@/src/db/schema";
import { projectAuthenticatedUser } from "./projection";
export { projectAuthenticatedUser } from "./projection";

export async function syncAuthenticatedUser(user: User) {
  const identity = projectAuthenticatedUser(user);
  if (!identity) return null;
  const [row] = await db.insert(userProfiles).values(identity).onConflictDoUpdate({
    target: userProfiles.userId,
    set: { email: identity.email, displayName: identity.displayName },
  }).returning();
  return row ?? db.query.userProfiles.findFirst({
    where: { RAW: (table, operators) => eq(table.userId, identity.userId) ?? operators.sql`true` },
  });
}
