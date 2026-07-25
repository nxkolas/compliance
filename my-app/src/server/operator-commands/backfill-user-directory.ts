import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import { organizationMemberships } from "@/src/db/schema";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";
import { syncAuthenticatedUser } from "@/src/server/users";

const batchSize = 50;

async function main() {
  const rows = await db
    .selectDistinct({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .orderBy(organizationMemberships.userId);
  const admin = getSupabaseAdminClient();
  const missing: string[] = [];

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const users = await Promise.all(
      batch.map(async ({ userId }) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error || !data.user) {
          missing.push(userId);
          return null;
        }
        return data.user;
      }),
    );
    for (const user of users) {
      if (user) await syncAuthenticatedUser(user);
    }
  }

  const [{ count }] = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from user_directory`,
  );
  console.log(
    `User directory backfill complete: ${count} projected, ${missing.length} missing.`,
  );
  if (missing.length) console.warn(`Missing Auth identities: ${missing.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());

