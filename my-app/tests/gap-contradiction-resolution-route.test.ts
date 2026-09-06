import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  enqueue: vi.fn(),
  getAuthorizedJob: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/src/server/platform/http/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/src/server/platform/http/idempotency", () => ({
  runIdempotentCommand: vi.fn(async (input) => ({ value: await input.execute(), reused: false })),
}));
vi.mock("@/src/server/modules/gap-analysis", () => ({ enqueueGapContradictionResolution: mocks.enqueue }));
vi.mock("@/src/server/platform/jobs", () => ({
  getAuthorizedJob: mocks.getAuthorizedJob,
  toJobDto: (job: unknown) => job,
}));
vi.mock("@/src/server/platform/idempotency", () => ({ databaseIdempotencyRepository: {} }));

import { POST } from "@/app/api/organizations/[organizationId]/gap-analysis/revisions/[revisionId]/contradictions/[findingId]/resolve/route";

const userId = "00000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000002";
const revisionId = "00000000-0000-4000-8000-000000000003";
const findingId = "00000000-0000-4000-8000-000000000004";
const jobId = "00000000-0000-4000-8000-000000000005";
const context = { params: Promise.resolve({ organizationId, revisionId, findingId }) };

function request(body: unknown) {
  return new Request("http://localhost/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "resolve-1" },
    body: JSON.stringify(body),
  });
}

describe("Gap contradiction resolution route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: userId });
    mocks.enqueue.mockResolvedValue({ id: jobId });
  });

  it.each(["questionnaire", "document"] as const)("accepts only the %s source decision", async (sourceChoice) => {
    const response = await POST(request({ sourceChoice }), context);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ data: { job: { id: jobId }, reused: false } });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      userId,
      organizationId,
      revisionId,
      findingId,
      sourceChoice,
    });
  });

  it.each([
    { sourceChoice: "legal" },
    { sourceChoice: "questionnaire", explanation: "Prefer this" },
    {},
  ])("rejects any third choice or explanation %#", async (body) => {
    const response = await POST(request(body), context);
    expect(response.status).toBe(400);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
