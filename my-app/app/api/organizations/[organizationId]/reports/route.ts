import { reportCreateSchema } from "@/src/contracts/reports";
import { requireApiUser } from "@/src/server/platform/http/auth";
import { apiRoute } from "@/src/server/platform/http/handler";
import { claimIdempotency, completeIdempotency, failIdempotency, fingerprintRequest, requireIdempotencyKey } from "@/src/server/platform/http/idempotency";
import { parseInput, readJsonBody } from "@/src/server/platform/http/request";
import { databaseIdempotencyRepository } from "@/src/server/platform/idempotency";
import { createReport, getReportDetail, listReportsPage } from "@/src/server/modules/reports";
import { enforceOperationRateLimit } from "@/src/server/platform/http/operation-rate-limit";
import { paginationQuerySchema } from "@/src/contracts/common/pagination";
type Context = { params: Promise<{ organizationId: string }> };
export const GET = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  const query = parseInput(paginationQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const result = await listReportsPage({ userId: user.id, organizationId, ...query });
  return { data: { reports: result.reports }, meta: { nextCursor: result.nextCursor } };
});
export const POST = apiRoute(async ({ request, routeContext }: { request: Request; routeContext: Context }) => {
  const user = await requireApiUser(); const { organizationId } = await routeContext.params;
  await enforceOperationRateLimit({ userId: user.id, operation: "reports:create", scopeId: organizationId });
  const body = await readJsonBody(request, reportCreateSchema);
  const claim = await claimIdempotency(databaseIdempotencyRepository, { actorKey: user.id, organizationId, scope: organizationId, operation: "report.create", key: requireIdempotencyKey(request), requestFingerprint: fingerprintRequest(body) });
  if (claim.kind === "replay" && claim.record.resultReference) {
    const detail = await getReportDetail(user.id, organizationId, claim.record.resultReference.id);
    return { status: 202, data: { report: detail.report, job: detail.job, reused: true } };
  }
  try {
    const result = await createReport({ userId: user.id, organizationId, ...body });
    await completeIdempotency(databaseIdempotencyRepository, claim.record, { responseStatus: 202, resultReference: { type: "report", id: result.report.id } });
    return { status: 202, data: { ...result, reused: false } };
  } catch (error) { await failIdempotency(databaseIdempotencyRepository, claim.record); throw error; }
});
