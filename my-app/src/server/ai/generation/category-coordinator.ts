import {
  createGenerationDiagnostic,
  type GenerationDiagnostic,
  type GenerationIssueCode,
} from "./diagnostics";
import { classifyGenerationFailure, GenerationFailure } from "./failures";
import { combineAbortSignals, throwIfGenerationCancelled } from "./abort";
import { emitGenerationMetric } from "./metrics";

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
  onAcceptedCategory?(
    output: TOutput,
    task: CategoryTask<TInput>,
  ): Promise<void> | void;
}): Promise<CategoryCoordinatorResult<TOutput>> {
  const concurrency = Math.max(1, Math.min(10, input.concurrency ?? 3));
  const diagnostics: GenerationDiagnostic[] = [];
  const results = new Array<TOutput>(input.tasks.length);
  const failureController = new AbortController();
  const workerSignal = combineAbortSignals([
    input.signal,
    failureController.signal,
  ]);
  let cursor = 0;
  let primaryFailure: unknown;
  let primaryFailureAt: number | undefined;
  let recoveredCategoryCount = 0;

  const record = async (diagnostic: GenerationDiagnostic) => {
    diagnostics.push(diagnostic);
    const metricName =
      diagnostic.phase === "initial" &&
      (diagnostic.disposition === "accepted" ||
        diagnostic.disposition === "normalized") &&
      (diagnostic.stage === "content" || diagnostic.stage === "normalization")
        ? "category_initial_accepted"
        : diagnostic.disposition === "repair_requested" &&
            diagnostic.stage !== "provider"
          ? "category_repair_requested"
          : diagnostic.phase === "repair" &&
              (diagnostic.disposition === "accepted" ||
                diagnostic.disposition === "normalized") &&
              (diagnostic.stage === "content" ||
                diagnostic.stage === "normalization")
            ? "category_repair_accepted"
            : diagnostic.phase === "repair" &&
                diagnostic.disposition === "rejected"
              ? "category_repair_exhausted"
              : diagnostic.disposition === "cancelled"
                ? "sibling_provider_aborted"
                : null;
    if (metricName) {
      emitGenerationMetric({
        name: metricName,
        value: 1,
        categoryCode: diagnostic.categoryCode,
        phase: diagnostic.phase,
        safeCode: diagnostic.issues[0]?.code,
      });
    }
    await input.onDiagnostic?.(diagnostic);
  };

  async function worker() {
    while (primaryFailure === undefined) {
      throwIfGenerationCancelled(workerSignal);
      const index = cursor;
      cursor += 1;
      if (index >= input.tasks.length) return;
      const task = input.tasks[index]!;
      try {
        const recovered = await input.recover?.(task);
        if (recovered !== null && recovered !== undefined) {
          results[index] = recovered;
          recoveredCategoryCount += 1;
          await input.onAcceptedCategory?.(recovered, task);
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
        const output = await executeTask(task, record);
        results[index] = output;
        await input.onAcceptedCategory?.(output, task);
      } catch (error) {
        const failure = classifyGenerationFailure(error);
        if (
          failure.failureClass === "cancelled" &&
          primaryFailure !== undefined
        ) {
          return;
        }
        if (primaryFailure === undefined) {
          primaryFailure = error;
          primaryFailureAt = Date.now();
          failureController.abort("terminal category failure");
        }
        return;
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
      let validation: Awaited<ReturnType<typeof runProviderWithTransientRetry>>;
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
    for (
      let providerAttempt = 1;
      providerAttempt <= retries + 1;
      providerAttempt += 1
    ) {
      throwIfGenerationCancelled(workerSignal);
      const providerStartedAt = Date.now();
      try {
        const candidate = await input.generate({
          phase: options.phase,
          task: options.task,
          rejectedCandidate: options.rejectedCandidate,
          issues,
          signal: workerSignal,
          providerAttempt,
        });
        emitGenerationMetric({
          name: "provider_attempt_ms",
          value: Date.now() - providerStartedAt,
          categoryCode: options.task.categoryCode,
          phase: options.phase,
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
        const validationStartedAt = Date.now();
        const result = await input.validate(candidate, options.task);
        emitGenerationMetric({
          name: "validation_ms",
          value: Date.now() - validationStartedAt,
          categoryCode: options.task.categoryCode,
          phase: options.phase,
        });
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
        await abortableDelay(delay, workerSignal);
      }
    }
    throw new Error("Provider retry bound was exceeded");
  }

  const workerPromises = Array.from(
    { length: Math.min(concurrency, input.tasks.length) },
    () => worker(),
  );
  await Promise.allSettled(workerPromises);
  if (primaryFailureAt !== undefined) {
    emitGenerationMetric({
      name: "primary_failure_settlement_ms",
      value: Date.now() - primaryFailureAt,
    });
  }
  if (primaryFailure !== undefined) throw primaryFailure;
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
