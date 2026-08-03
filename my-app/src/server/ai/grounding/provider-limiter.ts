import type { GroundedProvider } from "./types";
import { emitGenerationMetric } from "../generation/metrics";
import { configuredProviderMaxConcurrency } from "../generation/concurrency";

type Waiter = {
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort: () => void;
};

export class ProviderLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(readonly maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 100) {
      throw new Error("Provider concurrency must be an integer between 1 and 100");
    }
  }

  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(abortError());
    if (this.active < this.maximum) {
      this.active += 1;
      return Promise.resolve(this.releaseOnce());
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        signal,
        onAbort: () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(abortError());
        },
      };
      signal?.addEventListener("abort", waiter.onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  private releaseOnce() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter.signal?.removeEventListener("abort", waiter.onAbort);
        waiter.resolve(this.releaseOnce());
      } else {
        this.active -= 1;
      }
    };
  }
}

const singletonKey = Symbol.for("compliancetool.ai-provider-limiter");
type GlobalWithLimiter = typeof globalThis & { [singletonKey]?: ProviderLimiter };

export function sharedProviderLimiter() {
  const target = globalThis as GlobalWithLimiter;
  return (target[singletonKey] ??= new ProviderLimiter(
    configuredProviderMaxConcurrency(),
  ));
}

export function withProviderPermit(
  provider: GroundedProvider,
  metadata: { jobId?: string; categoryCode?: string } = {},
): GroundedProvider {
  return {
    ...provider,
    async run(input) {
      const waitingAt = Date.now();
      const release = await sharedProviderLimiter().acquire(input.abortSignal);
      emitGenerationMetric({
        name: "provider_permit_wait_ms",
        value: Date.now() - waitingAt,
        jobId: metadata.jobId,
        categoryCode: metadata.categoryCode,
      });
      try {
        return await provider.run(input);
      } finally {
        release();
      }
    },
  };
}

function abortError() {
  const error = new Error("Provider wait was cancelled");
  error.name = "AbortError";
  return error;
}
