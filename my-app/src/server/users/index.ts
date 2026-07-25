import { eq, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { userDirectory } from "@/src/db/schema";

import type { User } from "@supabase/supabase-js";
import { projectAuthenticatedUser } from "./projection";
export { projectAuthenticatedUser } from "./projection";

export async function syncAuthenticatedUser(user: User) {
  const identity = projectAuthenticatedUser(user);
  if (!identity) return null;

  const [row] = await db
    .insert(userDirectory)
    .values(identity)
    .onConflictDoUpdate({
      target: userDirectory.userId,
      set: {
        email: identity.email,
        displayName: identity.displayName,
        updatedAt: new Date(),
      },
      setWhere: sql`${userDirectory.email} is distinct from ${identity.email}
        or ${userDirectory.displayName} is distinct from ${identity.displayName}`,
    })
    .returning();

  return (
    row ??
    db.query.userDirectory.findFirst({
      where: eq(userDirectory.userId, identity.userId),
      columns: {
        userId: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  );
}
