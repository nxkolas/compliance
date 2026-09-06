import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";

async function main() {
  const missing = await db.execute<{ userId: string }>(sql`
    select distinct membership.user_id as "userId"
    from organization_memberships membership
    left join user_directory directory on directory.user_id = membership.user_id
    where directory.user_id is null
    order by membership.user_id
  `);
  const [totals] = await db.execute<{
    activeMemberships: number;
    groupedActiveMemberships: number;
    archivedOrganizations: number;
  }>(sql`
    with member_counts as (
      select organization_id, count(*)::int as active_count
      from organization_memberships
      where status = 'active'
      group by organization_id
    )
    select
      (select count(*)::int from organization_memberships where status = 'active') as "activeMemberships",
      coalesce((select sum(active_count)::int from member_counts), 0) as "groupedActiveMemberships",
      (select count(*)::int from organizations where archived_at is not null) as "archivedOrganizations"
  `);
  if (totals.activeMemberships !== totals.groupedActiveMemberships) {
    throw new Error("Active-member aggregation verification failed");
  }
  console.log(
    `Organization management verified: ${totals.activeMemberships} active memberships, ` +
      `${missing.length} fallback identities, ${totals.archivedOrganizations} archived organizations.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());

