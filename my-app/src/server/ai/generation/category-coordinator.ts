import {
  createGenerationDiagnostic,
  type GenerationDiagnostic,
  type GenerationIssueCode,
} from "./diagnostics";
import {
  classifyGenerationFailure,
  GenerationFailure,
} from "./failures";
import { throwIfGenerationCancelled } from "./abort";

export type CategoryValidation<T> =
  | { valid: true; value: T; normalizedIssueCodes?: GenerationIssueCode[] }
  | {
      valid: false;
      failureClass: "repairable_style" | "repairable_content";
      issues: GenerationDiagnostic["issues"];
    };

export type CategoryTask<TInput> = {
  categoryCode: string;
  taskId: string;
  input: TInput;
};

export type CategoryAttemptContext<TInput, TCandidate> = {
  task: CategoryTask<TInput>;
  phase: "initial" | "repair";
  rejectedCandidate?: TCandidate;
  issues?: GenerationDiagnostic["issues"];
  signal: AbortSignal;
  providerAttempt: number;
};

export type CategoryCoordinatorResult<TOutput> = {
  categories: TOutput[];
  diagnostics: GenerationDiagnostic[];
  recoveredCategoryCount: number;
};

export async function coordinateCategoryGeneration<
  TInput,
  TCandidate,
  TOutput,
>(input: {
  tasks: Array<CategoryTask<TInput>>;
  signal: AbortSignal;
  concurrency?: number;
  recover?(task: CategoryTask<TInput>): Promise<TOutput | null>;
  generate(
    context: CategoryAttemptContext<TInput, TCandidate>,
  ): Promise<TCandidate>;
  validate(
    candidate: TCandidate,
    task: CategoryTask<TInput>,
  ): Promise<CategoryValidation<TOutput>> | CategoryValidation<TOutput>;
  transientRetries?: number;
  backoffMs?: (retryNumber: number) => number;
  onDiagnostic?(diagnostic: GenerationDiagnostic): Promise<void> | void;
}): Promise<CategoryCoordinatorResult<TOutput>> {
  const concurrency = Math.max(1, Math.min(10, input.concurrency ?? 3));
  const diagnostics: GenerationDiagnostic[] = [];
  const results = new Array<TOutput>(input.tasks.length);
  let cursor = 0;
  let terminalFailure: unknown;
  let recoveredCategoryCount = 0;

  const record = async (diagnostic: GenerationDiagnostic) => {
    diagnostics.push(diagnostic);
    await input.onDiagnostic?.(diagnostic);
  };

  async function worker() {
    while (terminalFailure === undefined) {
      throwIfGenerationCancelled(input.signal);
      const index = cursor;
      cursor += 1;
      if (index >= input.tasks.length) return;
      const task = input.tasks[index]!;
      try {
        const recovered = await input.recover?.(task);
        if (recovered !== null && recovered !== undefined) {
          results[index] = recovered;
          recoveredCategoryCount += 1;
          await record(
            createGenerationDiagnostic({
              stage: "persistence",
              categoryCode: task.categoryCode,
              phase: "initial",
              disposition: "accepted",
              durationMs: 0,
            }),
          );
          continue;
        }
        results[index] = await executeTask(task, record);
      } catch (error) {
        terminalFailure ??= error;
        throw error;
      }
    }
  }

  async function executeTask(
    task: CategoryTask<TInput>,
    addDiagnostic: (diagnostic: GenerationDiagnostic) => Promise<void>,
  ) {
    let candidate: TCandidate | undefined;
    let repairIssues: GenerationDiagnostic["issues"] | undefined;
    for (const phase of ["initial", "repair"] as const) {
      const startedAt = Date.now();
      let validation: Awaited<
        ReturnType<typeof runProviderWithTransientRetry>
      >;
      try {
        validation = await runProviderWithTransientRetry({
          phase,
          task,
          rejectedCandidate: candidate,
          issues: repairIssues,
        });
      } catch (error) {
        const failure = classifyGenerationFailure(error);
        if (
          phase === "initial" &&
          (failure.failureClass === "repairable_content" ||
            failure.failureClass === "repairable_style")
        ) {
          repairIssues = [
            {
              code:
                failure.safeCode === "AI_OUTPUT_LANGUAGE_MISMATCH"
                  ? "language_mismatch"
                  : "content_invalid",
              path: [],
            },
          ];
          await addDiagnostic(
            createGenerationDiagnostic({
              stage:
                failure.safeCode === "AI_OUTPUT_LANGUAGE_MISMATCH"
                  ? "language"
                  : "content",
              categoryCode: task.categoryCode,
              phase,
              disposition: "repair_requested",
              durationMs: Date.now() - startedAt,
              issues: repairIssues,
            }),
          );
          continue;
        }
        throw error;
      }
      candidate = validation.candidate;
      const disposition = validation.result.valid
        ? validation.result.normalizedIssueCodes?.length
          ? "normalized"
          : "accepted"
        : phase === "initial"
          ? "repair_requested"
          : "rejected";
      await addDiagnostic(
        createGenerationDiagnostic({
          stage: validation.result.valid
            ? validation.result.normalizedIssueCodes?.length
              ? "normalization"
              : "content"
            : "content",
          categoryCode: task.categoryCode,
          phase,
          disposition,
          durationMs: Date.now() - startedAt,
          issues: validation.result.valid
            ? validation.result.normalizedIssueCodes?.map((code) => ({
                code,
                path: [],
              }))
            : validation.result.issues,
        }),
      );
      if (validation.result.valid) return validation.result.value;
      repairIssues = validation.result.issues;
      if (phase === "repair") {
        throw new GenerationFailure(
          validation.result.failureClass,
          "GENERATION_CATEGORY_REPAIR_EXHAUSTED",
        );
      }
    }
    throw new Error("Category repair bound was exceeded");
  }

  async function runProviderWithTransientRetry(options: {
    phase: "initial" | "repair";
    task: CategoryTask<TInput>;
    rejectedCandidate?: TCandidate;
    issues?: GenerationDiagnostic["issues"];
  }) {
    const retries = Math.max(0, Math.min(2, input.transientRetries ?? 2));
    let issues = options.issues;
    for (let providerAttempt = 1; providerAttempt <= retries + 1; providerAttempt += 1) {
      throwIfGenerationCancelled(input.signal);
      const providerStartedAt = Date.now();
      try {
        const candidate = await input.generate({
          phase: options.phase,
          task: options.task,
          rejectedCandidate: options.rejectedCandidate,
          issues,
          signal: input.signal,
          providerAttempt,
        });
        await record(
          createGenerationDiagnostic({
            stage: "provider",
            categoryCode: options.task.categoryCode,
            phase: options.phase,
            disposition: "accepted",
            durationMs: Date.now() - providerStartedAt,
          }),
        );
        const result = await input.validate(candidate, options.task);
        if (!result.valid) issues = result.issues;
        return { candidate, result };
      } catch (error) {
        const failure = classifyGenerationFailure(error);
        await record(
          createGenerationDiagnostic({
            stage: "provider",
            categoryCode: options.task.categoryCode,
            phase: options.phase,
            disposition:
              failure.failureClass === "cancelled"
                ? "cancelled"
                : failure.failureClass === "transient_provider" &&
                    providerAttempt <= retries
                  ? "repair_requested"
                  : "rejected",
            durationMs: Date.now() - providerStartedAt,
            issues: [
              {
                code:
                  failure.failureClass === "cancelled"
                    ? "cancelled"
                    : failure.failureClass === "transient_provider"
                      ? "provider_transient"
                      : "provider_terminal",
                path: [],
              },
            ],
          }),
        );
        if (
          failure.failureClass !== "transient_provider" ||
          providerAttempt > retries
        ) {
          throw failure;
        }
        const delay =
          failure.retryAfterMs ??
          input.backoffMs?.(providerAttempt) ??
          defaultBackoffMs(providerAttempt);
        await abortableDelay(delay, input.signal);
      }
    }
    throw new Error("Provider retry bound was exceeded");
  }

  try {
    await Promise.all(
      Array.from(
        { length: Math.min(concurrency, input.tasks.length) },
        () => worker(),
      ),
    );
  } catch (error) {
    if (terminalFailure === undefined) terminalFailure = error;
  }
  if (terminalFailure !== undefined) throw terminalFailure;
  throwIfGenerationCancelled(input.signal);
  return { categories: results, diagnostics, recoveredCategoryCount };
}

function defaultBackoffMs(retryNumber: number) {
  const base = Math.min(2_000, 250 * 2 ** (retryNumber - 1));
  return base + Math.trunc(Math.random() * Math.max(1, base / 4));
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(done, Math.max(0, Math.min(30_000, milliseconds)));
    function done() {
      signal.removeEventListener("abort", aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      const error = new Error("Generation was cancelled");
      error.name = "AbortError";
      reject(error);
    }
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}
