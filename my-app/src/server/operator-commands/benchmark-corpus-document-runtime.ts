import "dotenv/config";

import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import { closeDbConnection, db, setDbQueryObserver } from "@/src/db";
import {
  getLegalSource,
  listCorpusReleasesPage,
  listLegalSourcesPage,
} from "@/src/server/corpus";
import { getOrganizationDocumentLibrary } from "@/src/server/documents";

const argumentsByName = parseArguments(process.argv.slice(2));
const sampleCount = Number(argumentsByName.get("samples") ?? "3");
const assertionMode = argumentsByName.has("assert");

async function main() {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("Invalid sample count");
  }
  if (assertionMode && sampleCount < 3) {
    throw new Error("Assertion mode requires at least three warm samples");
  }
  const fixture = await resolveFixture();
  const sources = await listLegalSourcesPage({
    userId: fixture.userId,
    limit: 1,
  });
  const sourceId = sources.sources[0]?.id;
  if (!sourceId) throw new Error("No legal source benchmark fixture is available");

  const operations = [
    {
      name: "documentLibrary",
      maxCalls: 4,
      run: () =>
        getOrganizationDocumentLibrary(
          fixture.userId,
          fixture.organizationId,
        ),
      shape: (value: unknown) => ({
        documentCount: (value as { documents: unknown[] }).documents.length,
      }),
    },
    {
      name: "legalSourceList",
      maxCalls: 2,
      run: () =>
        listLegalSourcesPage({ userId: fixture.userId, limit: 100 }),
      shape: (value: unknown) => ({
        sourceCount: (value as { sources: unknown[] }).sources.length,
      }),
    },
    {
      name: "legalSourceDetail",
      maxCalls: 3,
      run: () => getLegalSource(fixture.userId, sourceId),
      shape: (value: unknown) => ({
        versionCount: (value as { versions: unknown[] }).versions.length,
      }),
    },
    {
      name: "corpusReleaseList",
      maxCalls: 2,
      run: () =>
        listCorpusReleasesPage({ userId: fixture.userId, limit: 100 }),
      shape: (value: unknown) => ({
        releaseCount: (value as { releases: unknown[] }).releases.length,
      }),
    },
  ];

  const results = [];
  for (const operation of operations) {
    const cold = await measure(operation.run);
    const expectedShape = operation.shape(cold.value);
    const warm = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = await measure(operation.run);
      if (
        JSON.stringify(operation.shape(sample.value)) !==
        JSON.stringify(expectedShape)
      ) {
        throw new Error(`${operation.name} response shape changed between samples`);
      }
      warm.push(sample);
    }
    const sortedWall = warm
      .map((sample) => sample.wallMs)
      .sort((left, right) => left - right);
    const result = {
      operation: operation.name,
      responseShape: expectedShape,
      cold: report(cold),
      warm: warm.map(report),
      warmMedianMs: round(percentile(sortedWall, 0.5)),
      warmP95Ms: round(percentile(sortedWall, 0.95)),
      maxSqlCalls: operation.maxCalls,
    };
    results.push(result);
    if (assertionMode) {
      if (result.warmP95Ms > 600) {
        throw new Error(
          `${operation.name} warm p95 ${result.warmP95Ms} ms exceeds 600 ms`,
        );
      }
      if (result.warm.some((sample) => sample.sqlCalls > operation.maxCalls)) {
        throw new Error(
          `${operation.name} exceeded its ${operation.maxCalls}-call SQL budget`,
        );
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        fixture,
        samples: sampleCount,
        assertionMode,
        results,
      },
      null,
      2,
    ),
  );
}

async function resolveFixture() {
  const organizationId =
    argumentsByName.get("organization-id") ??
    process.env.CORPUS_DOCUMENT_BENCHMARK_ORGANIZATION_ID;
  const userId =
    argumentsByName.get("user-id") ??
    process.env.CORPUS_DOCUMENT_BENCHMARK_USER_ID;
  if (organizationId && userId) return { organizationId, userId };
  const rows = await db.execute<{
    organization_id: string;
    user_id: string;
  }>(sql`
    select membership.organization_id, membership.user_id
    from organization_memberships membership
    inner join platform_administrators administrator
      on administrator.user_id = membership.user_id
      and administrator.revoked_at is null
    where membership.status = 'active'
    order by membership.created_at desc
    limit 1
  `);
  const fixture = rows[0];
  if (!fixture) {
    throw new Error(
      "Provide organization-id and user-id for an active platform administrator membership",
    );
  }
  return {
    organizationId: fixture.organization_id,
    userId: fixture.user_id,
  };
}

async function measure(run: () => Promise<unknown>) {
  const queries: string[] = [];
  setDbQueryObserver((query) => queries.push(query));
  const startedAt = performance.now();
  try {
    const value = await run();
    return {
      value,
      wallMs: performance.now() - startedAt,
      sqlCalls: queries.length,
    };
  } finally {
    setDbQueryObserver();
  }
}

function report(sample: Awaited<ReturnType<typeof measure>>) {
  return {
    wallMs: round(sample.wallMs),
    sqlCalls: sample.sqlCalls,
  };
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
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Corpus/Document runtime benchmark failed",
    );
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
