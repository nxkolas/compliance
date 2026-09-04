import { randomUUID } from "node:crypto";
import { after } from "next/server";
const AFTER_RESPONSE_DRAIN_POLICY = {
  invocationMs: 4 * 60 * 1_000 + 45 * 1_000,
  maxJobs: 25,
} as const;

type AfterScheduler = (callback: () => void | Promise<void>) => void;

export function scheduleAfterResponseDrain(input: {
  requestId: string;
  schedule?: AfterScheduler;
}) {
  const adapter = "after_response" as const;
  const invocationId = `${adapter}-${randomUUID()}`;
  try {
    (input.schedule ?? after)(async () => {
      try {
        const { drainPortableJobs } = await import("./runtime");
        await drainPortableJobs({
          invocationId,
          adapter,
          maxJobs: AFTER_RESPONSE_DRAIN_POLICY.maxJobs,
          deadline: new Date(
            Date.now() + AFTER_RESPONSE_DRAIN_POLICY.invocationMs,
          ),
        });
      } catch (error) {
        console.error("After-response job drain failed", {
          invocationId,
          requestId: input.requestId,
          adapter,
          errorType: error instanceof Error ? error.name : "unknown",
        });
      }
    });
    return true;
  } catch (error) {
    // Direct route unit tests and non-Next hosts do not provide a request work
    // store. The durable PostgreSQL row remains recoverable by another adapter.
    console.error("Could not schedule after-response job drain", {
      invocationId,
      requestId: input.requestId,
      adapter,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
