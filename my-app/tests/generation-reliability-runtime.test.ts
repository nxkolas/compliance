import { describe, expect, it, vi } from "vitest";
import {
  classifyGenerationFailure,
  combineAbortSignals,
  coordinateCategoryGeneration,
  normalizeOneLine,
  normalizeUniqueStrings,
  safeGenerationIssues,
} from "@/src/server/ai/generation";
import { ApiError } from "@/src/server/api/errors";

describe("generation reliability runtime", () => {
  it("keeps diagnostics allowlisted and excludes issue prose", () => {
    const issues = safeGenerationIssues([
      {
        code: "custom",
        path: ["categories", "SECRET GENERATED PROSE", 0],
        message: "source excerpt and rejected prose",
        input: "private source",
      },
    ]);
    expect(issues).toEqual([
      {
        code: "custom",
        path: ["categories", "unknown", 0],
      },
    ]);
    expect(JSON.stringify(issues)).not.toContain("source excerpt");
    expect(JSON.stringify(issues)).not.toContain("private source");
    expect(JSON.stringify(issues)).not.toContain("SECRET GENERATED PROSE");
  });

  it("classifies terminal, transient, content, and cancellation failures", () => {
    expect(
      classifyGenerationFailure(new ApiError(409, "stale")).failureClass,
    ).toBe("terminal_input");
    expect(
      classifyGenerationFailure(new ApiError(422, "invalid")).failureClass,
    ).toBe("repairable_content");
    expect(
      classifyGenerationFailure(
        new ApiError(429, "limited", undefined, "RATE_LIMITED", {
          "Retry-After": "2",
        }),
      ),
    ).toMatchObject({
      failureClass: "transient_provider",
      retryAfterMs: 2_000,
    });
    const aborted = new Error("abort");
    aborted.name = "AbortError";
    expect(classifyGenerationFailure(aborted).failureClass).toBe("cancelled");
  });

  it("combines cancellation and timeout signals", () => {
    const cancellation = new AbortController();
    const timeout = new AbortController();
    const combined = combineAbortSignals([cancellation.signal, timeout.signal]);
    cancellation.abort("cancelled");
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe("cancelled");
  });

  it("normalizes only allowlisted presentation defects idempotently", () => {
    const first = normalizeOneLine("  A control\nexists  ", {
      finalPeriod: true,
    });
    expect(first.value).toBe("A control exists.");
    expect(first.codes).toEqual(
      expect.arrayContaining([
        "normalized_whitespace",
        "normalized_line_wrap",
        "normalized_period",
      ]),
    );
    expect(normalizeOneLine(first.value, { finalPeriod: true })).toEqual({
      value: first.value,
      codes: [],
    });
    expect(
      normalizeUniqueStrings([" Policy ", "policy", "Record"], "en").value,
    ).toEqual(["Policy", "Record"]);
  });

  it("repairs only the rejected category and preserves release order", async () => {
    const calls: string[] = [];
    const result = await coordinateCategoryGeneration<
      string,
      { code: string; valid: boolean },
      string
    >({
      signal: new AbortController().signal,
      concurrency: 2,
      tasks: ["A", "B", "C"].map((categoryCode) => ({
        categoryCode,
        taskId: categoryCode,
        input: categoryCode,
      })),
      async generate({ task, phase }) {
        calls.push(`${task.categoryCode}:${phase}`);
        return {
          code: task.categoryCode,
          valid: task.categoryCode !== "B" || phase === "repair",
        };
      },
      validate(candidate) {
        return candidate.valid
          ? { valid: true as const, value: candidate.code }
          : {
              valid: false as const,
              failureClass: "repairable_content" as const,
              issues: [
                { code: "coverage_incomplete" as const, path: ["gaps"] },
              ],
            };
      },
    });
    expect(result.categories).toEqual(["A", "B", "C"]);
    expect(calls.filter((call) => call.startsWith("A:"))).toEqual([
      "A:initial",
    ]);
    expect(calls.filter((call) => call.startsWith("B:"))).toEqual([
      "B:initial",
      "B:repair",
    ]);
    expect(calls.filter((call) => call.startsWith("C:"))).toEqual([
      "C:initial",
    ]);
  });

  it("reuses recovered categories and bounds concurrency", async () => {
    let active = 0;
    let maximum = 0;
    const generate = vi.fn(
      async ({ task }: { task: { categoryCode: string } }) => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return task.categoryCode;
      },
    );
    const result = await coordinateCategoryGeneration<string, string, string>({
      signal: new AbortController().signal,
      concurrency: 2,
      tasks: ["A", "B", "C", "D"].map((categoryCode) => ({
        categoryCode,
        taskId: categoryCode,
        input: categoryCode,
      })),
      recover: async (task) => (task.categoryCode === "A" ? "A" : null),
      generate,
      validate: (candidate) => ({ valid: true, value: candidate }),
    });
    expect(result.categories).toEqual(["A", "B", "C", "D"]);
    expect(result.recoveredCategoryCount).toBe(1);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(maximum).toBeLessThanOrEqual(2);
  });

  it("retries a provider 429 inside one category without duplicating output", async () => {
    let attempts = 0;
    const result = await coordinateCategoryGeneration<string, string, string>({
      signal: new AbortController().signal,
      transientRetries: 2,
      backoffMs: () => 0,
      tasks: [{ categoryCode: "A", taskId: "A", input: "A" }],
      async generate() {
        attempts += 1;
        if (attempts < 3) {
          throw new ApiError(429, "limited", undefined, "RATE_LIMITED", {
            "Retry-After": "0",
          });
        }
        return "A";
      },
      validate: (candidate) => ({ valid: true, value: candidate }),
    });
    expect(attempts).toBe(3);
    expect(result.categories).toEqual(["A"]);
    expect(
      result.diagnostics.filter(
        (diagnostic) =>
          diagnostic.stage === "provider" &&
          diagnostic.issues[0]?.code === "provider_transient",
      ),
    ).toHaveLength(2);
  });

  it("does not retry terminal provider input failures", async () => {
    const generate = vi.fn(async () => {
      throw new ApiError(409, "stale", undefined, "GAP_REVISION_STALE");
    });
    await expect(
      coordinateCategoryGeneration<string, string, string>({
        signal: new AbortController().signal,
        tasks: [{ categoryCode: "A", taskId: "A", input: "A" }],
        generate,
        validate: (candidate) => ({ valid: true, value: candidate }),
      }),
    ).rejects.toMatchObject({ failureClass: "terminal_input" });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("exhausts one category repair without rerunning accepted categories", async () => {
    const calls: string[] = [];
    await expect(
      coordinateCategoryGeneration<string, string, string>({
        signal: new AbortController().signal,
        concurrency: 1,
        tasks: ["A", "B", "C"].map((categoryCode) => ({
          categoryCode,
          taskId: categoryCode,
          input: categoryCode,
        })),
        async generate({ task, phase }) {
          calls.push(`${task.categoryCode}:${phase}`);
          return task.categoryCode;
        },
        validate(candidate) {
          return candidate === "B"
            ? {
                valid: false,
                failureClass: "repairable_content",
                issues: [{ code: "content_invalid", path: [] }],
              }
            : { valid: true, value: candidate };
        },
      }),
    ).rejects.toMatchObject({
      safeCode: "GENERATION_CATEGORY_REPAIR_EXHAUSTED",
    });
    expect(calls).toEqual(["A:initial", "B:initial", "B:repair"]);
  });

  it("aborts and settles active siblings before preserving the first terminal failure", async () => {
    let active = 0;
    const started: string[] = [];
    const diagnostics: string[] = [];
    const generation = coordinateCategoryGeneration<string, string, string>({
      signal: new AbortController().signal,
      concurrency: 2,
      tasks: ["A", "B", "C"].map((categoryCode) => ({
        categoryCode,
        taskId: categoryCode,
        input: categoryCode,
      })),
      generate: ({ task, phase, signal }) => {
        started.push(`${task.categoryCode}:${phase}`);
        if (task.categoryCode === "B") return Promise.resolve("B");
        active += 1;
        return new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => {
            active -= 1;
            resolve(task.categoryCode);
          }, 250);
          const abort = () => {
            clearTimeout(timer);
            active -= 1;
            const error = new Error("sibling cancelled");
            error.name = "AbortError";
            reject(error);
          };
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        });
      },
      validate(candidate) {
        return candidate === "B"
          ? {
              valid: false,
              failureClass: "repairable_content",
              issues: [{ code: "content_invalid", path: [] }],
            }
          : { valid: true, value: candidate };
      },
      onDiagnostic(diagnostic) {
        diagnostics.push(
          `${diagnostic.categoryCode}:${diagnostic.disposition}`,
        );
      },
    });

    await expect(generation).rejects.toMatchObject({
      safeCode: "GENERATION_CATEGORY_REPAIR_EXHAUSTED",
    });
    expect(active).toBe(0);
    expect(started).not.toContain("C:initial");
    expect(diagnostics).toContain("A:cancelled");
    expect(diagnostics.at(-1)).toBe("A:cancelled");
  });

  it("aborts active categories and stops scheduling queued work", async () => {
    const controller = new AbortController();
    const started: string[] = [];
    const startedAt = Date.now();
    const generation = coordinateCategoryGeneration<string, string, string>({
      signal: controller.signal,
      concurrency: 2,
      tasks: ["A", "B", "C", "D"].map((categoryCode) => ({
        categoryCode,
        taskId: categoryCode,
        input: categoryCode,
      })),
      generate: ({ task, signal }) =>
        new Promise<string>((_resolve, reject) => {
          started.push(task.categoryCode);
          const abort = () => {
            const error = new Error("cancelled");
            error.name = "AbortError";
            reject(error);
          };
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        }),
      validate: (candidate) => ({ valid: true, value: candidate }),
    });
    setTimeout(() => controller.abort("operator cancellation"), 10);
    await expect(generation).rejects.toMatchObject({
      failureClass: "cancelled",
    });
    expect(started.sort()).toEqual(["A", "B"]);
    expect(Date.now() - startedAt).toBeLessThan(3_000);
  });
});
