import type * as z from "zod";
import { jobDtoSchema } from "@/src/contracts/common/jobs";
import { ApiClientError } from "./api-client";
import { jobsClient } from "./jobs";

type Job = z.infer<typeof jobDtoSchema>;
const terminalStates = new Set<Job["state"]>(["succeeded", "failed", "cancelled"]);

export async function pollJob(input: {
  jobId: string;
  signal: AbortSignal;
  onUpdate?: (job: Job) => void;
  finalRefresh: () => void | Promise<void>;
  maxDurationMs?: number;
}) {
  const startedAt = Date.now();
  const maxDurationMs = input.maxDurationMs ?? 15 * 60_000;
  let delayMs = 1_000;
  while (!input.signal.aborted) {
    await waitUntilVisible(input.signal);
    try {
      const result = await jobsClient.get(input.jobId, input.signal);
      input.onUpdate?.(result.data.job);
      if (terminalStates.has(result.data.job.state)) {
        await input.finalRefresh();
        return result.data.job;
      }
      delayMs = Math.min(10_000, Math.round(delayMs * 1.6));
    } catch (error) {
      if (input.signal.aborted) throw abortError();
      if (!(error instanceof ApiClientError) || (error.status < 500 && error.status !== 429)) throw error;
      delayMs = Math.max(delayMs, (error.retryAfterSeconds ?? 0) * 1_000);
    }
    if (Date.now() - startedAt >= maxDurationMs) throw new Error("Job polling timed out");
    await abortableDelay(delayMs, input.signal);
  }
  throw abortError();
}

function waitUntilVisible(signal: AbortSignal) {
  if (typeof document === "undefined" || document.visibilityState === "visible") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { document.removeEventListener("visibilitychange", onVisibility); signal.removeEventListener("abort", onAbort); };
    const onVisibility = () => { if (document.visibilityState === "visible") { cleanup(); resolve(); } };
    const onAbort = () => { cleanup(); reject(abortError()); };
    document.addEventListener("visibilitychange", onVisibility);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); resolve(); }, milliseconds);
    const onAbort = () => { cleanup(); reject(abortError()); };
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}
