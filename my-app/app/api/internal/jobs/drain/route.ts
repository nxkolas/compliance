import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { drainPortableJobs } from "@/src/server/platform/jobs/execution/runtime";
import { jsonError, jsonSuccess } from "@/src/server/platform/http/response";
import { resolveRequestId } from "@/src/server/platform/http/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const DRAIN_DEADLINE_MS = 4 * 60 * 1_000 + 45 * 1_000;

async function handle(request: Request) {
  const requestId = resolveRequestId(request);
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return jsonError(
      {
        status: 401,
        code: "JOB_DRAIN_UNAUTHORIZED",
        message: "Authentication required",
      },
      requestId,
      { "cache-control": "no-store" },
    );
  }

  const invocationId = `recovery-${randomUUID()}`;
  try {
    const result = await drainPortableJobs({
      invocationId,
      adapter: "recovery_route",
      maxJobs: 50,
      deadline: new Date(Date.now() + DRAIN_DEADLINE_MS),
    });
    return jsonSuccess(
      { drain: result },
      requestId,
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Recovery job drain failed", {
      invocationId,
      requestId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return jsonError(
      {
        status: 500,
        code: "JOB_DRAIN_FAILED",
        message: "Job recovery failed",
      },
      requestId,
      { "cache-control": "no-store" },
    );
  }
}

export const GET = handle;
export const POST = handle;

function authorized(header: string | null, secret: string | undefined) {
  if (!secret?.trim() || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice("Bearer ".length);
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(secret).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}
