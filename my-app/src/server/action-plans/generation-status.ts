import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { backgroundJobs } from "@/src/db/schema";
import { authorizeOrganizationRead } from "@/src/server/auth/organization-scope";

export async function getActionPlanGenerationStatus(userId: string, organizationId: string, revisionId: string | null) {
  const { executor } = await authorizeOrganizationRead({ actorUserId: userId, organizationId, capability: "plans:read" });
  if (!revisionId) return null;
  const active = inArray(backgroundJobs.state, ["queued", "leased", "running"]);
  const [job] = await executor.select({ id: backgroundJobs.id, state: backgroundJobs.state })
    .from(backgroundJobs)
    .where(and(
      eq(backgroundJobs.organizationId, organizationId),
      eq(backgroundJobs.kind, "action_plan_generation"),
      // Jobs from older Gap revisions must not affect the current preparation state.
      sql`${backgroundJobs.payload}->>'sourceGapRevisionId' = ${revisionId}`,
    ))
    .orderBy(sql`case when ${active} then 0 else 1 end`, desc(backgroundJobs.createdAt))
    .limit(1);
  return job ?? null;
}
