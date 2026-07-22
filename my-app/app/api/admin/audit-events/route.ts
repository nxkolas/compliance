import { platformAuditQuerySchema } from "@/src/contracts/admin";
import { requireApiUser } from "@/src/server/api/auth";
import { apiRoute } from "@/src/server/api/handler";
import { parseInput } from "@/src/server/api/request";
import { listPlatformAuditEvents } from "@/src/server/admin/operations-service";
export const GET = apiRoute(async ({ request }: { request: Request }) => {
  const user = await requireApiUser();
  const query = parseInput(platformAuditQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listPlatformAuditEvents({ userId: user.id, ...query });
  return { data: { events: result.events }, meta: { nextCursor: result.nextCursor } };
});
