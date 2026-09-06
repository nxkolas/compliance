import { connection } from "next/server";
import { apiRoute } from "@/src/server/platform/http/handler";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { listMailboxInvitationsForUserPage } from "@/src/server/modules/organizations";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
import { parseInput } from "@/src/server/platform/http/request";
export const GET = apiRoute(async ({ request }: { request: Request }) => {
  await connection(); const user = await requireApiUser();
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listMailboxInvitationsForUserPage({ user, ...query });
  return { data: { invitations: result.invitations }, meta: { nextCursor: result.nextCursor } };
});
