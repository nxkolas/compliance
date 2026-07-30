import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { JobExecutionAdapter } from "./contracts";

const PORTABLE_INVOCATION_MS = 4 * 60 * 1_000 + 45 * 1_000;
const PORTABLE_MAX_JOBS = 25;

type AfterScheduler = (callback: () => void | Promise<void>) => void;

export function scheduleAfterResponseDrain(input: {
  adapter: Extract<JobExecutionAdapter, "after_response" | "polling">;
  requestId: string;
  schedule?: AfterScheduler;
}) {
  const invocationId = `${input.adapter}-${randomUUID()}`;
  try {
    (input.schedule ?? after)(async () => {
      try {
        const { drainPortableJobs } = await import("./runtime");
        await drainPortableJobs({
          invocationId,
          adapter: input.adapter,
          maxJobs: PORTABLE_MAX_JOBS,
          deadline: new Date(Date.now() + PORTABLE_INVOCATION_MS),
        });
      } catch (error) {
        console.error("After-response job drain failed", {
          invocationId,
          requestId: input.requestId,
          adapter: input.adapter,
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
      adapter: input.adapter,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
