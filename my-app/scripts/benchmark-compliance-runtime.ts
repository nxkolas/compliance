import "dotenv/config";

import { performance } from "node:perf_hooks";
import { closeDbConnection } from "../src/db";
import {
  getApplicabilityOverviewForUser,
  getApplicabilityQuestionnaireForUser,
  getApplicabilityResultForUser,
} from "../src/server/applicability-check/service";
import { NIS2_CHECK_CODE } from "../src/server/compliance/runtime-release";
import {
  createRuntimeReleaseReader,
  directRuntimeReleaseReader,
} from "../src/server/compliance/runtime-release/direct-reader";
import type {
  PublishedComplianceRelease,
  RuntimeReleaseReader,
} from "../src/server/compliance/runtime-release/types";
import {
  getOrganizationForUser,
  listCurrentOrganizationFactsForUser,
} from "../src/server/organizations/service";

const argumentsByName = parseArguments(process.argv.slice(2));
const organizationId =
  argumentsByName.get("organization-id") ??
  process.env.COMPLIANCE_BENCHMARK_ORGANIZATION_ID;
const userId =
  argumentsByName.get("user-id") ??
  process.env.COMPLIANCE_BENCHMARK_USER_ID;
const sampleCount = Number(argumentsByName.get("samples") ?? "3");
const assertionMode = argumentsByName.has("assert");
const warmThresholdMs = Number(
  argumentsByName.get("read-threshold-ms") ?? "500",
);

async function main() {
  if (!organizationId || !userId) {
    throw new Error("Benchmark IDs are not configured");
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("Invalid sample count");
  }
  if (!Number.isFinite(warmThresholdMs) || warmThresholdMs <= 0) {
    throw new Error("Invalid read threshold");
  }
  const activePointer =
    await directRuntimeReleaseReader.getActivePointer(NIS2_CHECK_CODE);
  if (!activePointer) {
    throw new Error("Active compliance release is unavailable");
  }

  const operations: Array<{
    name: string;
    run: (reader: RuntimeReleaseReader) => Promise<unknown>;
  }> = [
    {
      name: "organizationLookup",
      run: () => getOrganizationForUser(userId!, organizationId!),
    },
    {
      name: "settingsFacts",
      run: (runtimeReleaseReader) =>
        listCurrentOrganizationFactsForUser(userId!, organizationId!, "de", {
          runtimeReleaseReader,
        }),
    },
    {
      name: "overview",
      run: (runtimeReleaseReader) =>
        getApplicabilityOverviewForUser(userId!, organizationId!, {
          runtimeReleaseReader,
        }),
    },
    {
      name: "questionnaire",
      run: (runtimeReleaseReader) =>
        getApplicabilityQuestionnaireForUser(
          userId!,
          organizationId!,
          "de",
          { runtimeReleaseReader },
        ),
    },
    {
      name: "result",
      run: (runtimeReleaseReader) =>
        getApplicabilityResultForUser(userId!, organizationId!, {
          runtimeReleaseReader,
        }),
    },
    {
      name: "activeRelease",
      run: (runtimeReleaseReader) =>
        runtimeReleaseReader.getActive({
          checkCode: NIS2_CHECK_CODE,
          locale: "de",
        }),
    },
    {
      name: "pinnedRelease",
      run: (runtimeReleaseReader) =>
        runtimeReleaseReader.getPublished({
          checkReleaseId: activePointer.checkReleaseId,
          locale: "de",
        }),
    },
  ];

  const results = [];
  for (const operation of operations) {
    const reader = createBenchmarkReader();
    const coldMs = await measure(() => operation.run(reader));
    const warmSamplesMs: number[] = [];
    for (let index = 0; index < sampleCount; index += 1) {
      warmSamplesMs.push(await measure(() => operation.run(reader)));
    }
    const sorted = [...warmSamplesMs].sort((left, right) => left - right);
    results.push({
      operation: operation.name,
      coldMs: round(coldMs),
      warmSamplesMs: warmSamplesMs.map(round),
      warmMedianMs: round(percentile(sorted, 0.5)),
      warmP95Ms: round(percentile(sorted, 0.95)),
      warmMaxMs: round(sorted.at(-1) ?? 0),
      thresholdMs: warmThresholdMs,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        samples: sampleCount,
        assertionMode,
        results,
      },
      null,
      2,
    ),
  );

  if (
    assertionMode &&
    results.some((result) => result.warmMedianMs > result.thresholdMs)
  ) {
    process.exitCode = 1;
  }
}

function createBenchmarkReader(): RuntimeReleaseReader {
  const cache = new Map<string, PublishedComplianceRelease | null>();
  return createRuntimeReleaseReader({
    async loadPublished(input) {
      const key = `${input.checkReleaseId}\u0000${input.locale}`;
      if (!cache.has(key)) {
        cache.set(
          key,
          await directRuntimeReleaseReader.getPublished(input),
        );
      }
      return cache.get(key) ?? null;
    },
    loadActivePointer: (checkCode) =>
      directRuntimeReleaseReader.getActivePointer(checkCode),
  });
}

async function measure(run: () => Promise<unknown>) {
  const startedAt = performance.now();
  await run();
  return performance.now() - startedAt;
}

function percentile(sorted: number[], quantile: number) {
  return sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)] ?? 0;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function parseArguments(values: string[]) {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const name = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      result.set(name, "true");
    } else {
      result.set(name, next);
      index += 1;
    }
  }
  return result;
}

void main()
  .catch(() => {
    console.error("Compliance runtime benchmark failed");
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
