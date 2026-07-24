import "dotenv/config";

import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import {
  closeDbConnection,
  db,
  setDbQueryObserver,
} from "@/src/db";
import { getOrganizationDocumentLibrary } from "@/src/server/documents";
import {
  createGapReleaseReader,
  createDatabaseGapPageReader,
  directGapReleaseReader,
  getGapAnalysisWorkflow,
  getGapReassessmentDraft,
  getGapRevisionStaleness,
  loadActiveGapAnalysisReleasePointer,
  loadGapHistoryPreauthorized,
  postgresGapPageData,
  readGeneratedGapInputs,
  type LoadedGapRelease,
} from "@/src/server/gap-analysis";

type Fixture = {
  organizationId: string;
  userId: string;
  assessmentId: string;
  revisionId: string | null;
};

type DatabaseStats = {
  calls: number;
  executionMs: number;
};

const argumentsByName = parseArguments(process.argv.slice(2));
const sampleCount = Number(argumentsByName.get("samples") ?? "3");
let databaseStatsAvailable: boolean | undefined;

async function main() {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("Invalid sample count");
  }
  if (argumentsByName.has("assert") && sampleCount < 3) {
    throw new Error("Assertion mode requires at least three warm samples");
  }
  const fixture = await resolveFixture();
  const requestedOperation = argumentsByName.get("operation");
  const operations = createOperations(fixture).filter(
    (operation) =>
      !requestedOperation || operation.name === requestedOperation,
  );
  if (!operations.length) {
    throw new Error(`Unknown benchmark operation: ${requestedOperation}`);
  }
  const results = [];
  for (const operation of operations) {
    const run = operation.create();
    const cold = await measure(run);
    const expectedShape = summarize(operation.name, cold.value);
    const warm = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = await measure(run);
      const shape = summarize(operation.name, sample.value);
      if (JSON.stringify(shape) !== JSON.stringify(expectedShape)) {
        throw new Error(`${operation.name} response shape changed between samples`);
      }
      warm.push(sample);
    }
    const sortedWall = warm
      .map((sample) => sample.wallMs)
      .sort((left, right) => left - right);
    results.push({
      operation: operation.name,
      responseShape: expectedShape,
      cold: reportSample(cold, operation.sequentialLayers),
      warm: warm.map((sample) =>
        reportSample(sample, operation.sequentialLayers),
      ),
      warmMedianMs: round(percentile(sortedWall, 0.5)),
      warmImprovementPercent:
        operation.name === "gapPage"
          ? round(((2480 - percentile(sortedWall, 0.5)) / 2480) * 100)
          : null,
    });
  }

  const report = {
    mode: "read-only",
    fixtureSource:
      argumentsByName.has("organization-id") &&
      argumentsByName.has("user-id")
        ? "arguments"
        : "auto-discovered",
    samples: sampleCount,
    databaseExecutionStats: databaseStatsAvailable
      ? "pg_stat_statements"
      : "unavailable",
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  if (argumentsByName.has("assert")) {
    const completeWorkflow = results.find(
      (result) => result.operation === "completeWorkflow",
    );
    if (!completeWorkflow) {
      throw new Error("Complete Gap workflow result is unavailable");
    }
    if (completeWorkflow.warmMedianMs > 500) {
      throw new Error(
        `Complete Gap workflow warm median ${completeWorkflow.warmMedianMs} ms exceeds 500 ms`,
      );
    }
    for (const sample of completeWorkflow.warm) {
      if (sample.sqlCalls > 17) {
        throw new Error(
          `Complete Gap workflow used ${sample.sqlCalls} SQL calls; expected at most 17`,
        );
      }
      if ((sample.sequentialLayers ?? Number.POSITIVE_INFINITY) > 5) {
        throw new Error(
          `Complete Gap workflow used ${sample.sequentialLayers} dependency layers; expected at most 5`,
        );
      }
      if (
        sample.authorizationCalls !== 1 ||
        sample.activePointerCalls !== 1 ||
        sample.immutableReleaseAssemblies !== 0
      ) {
        throw new Error(
          "Complete Gap workflow violated authorization, active-pointer, or immutable-release reuse budgets",
        );
      }
    }
  }
}

function createOperations(fixture: Fixture) {
  return [
    {
      name: "gapPage",
      create() {
        const reader = createBenchmarkReleaseReader();
        const pageReader = createDatabaseGapPageReader(reader);
        return () =>
          pageReader.readGap({
            userId: fixture.userId,
            organizationId: fixture.organizationId,
            locale: "de",
          });
      },
      sequentialLayers: 4,
    },
    {
      name: "documentsPage",
      create() {
        const reader = createBenchmarkReleaseReader();
        const pageReader = createDatabaseGapPageReader(reader);
        return () =>
          pageReader.readDocuments({
            userId: fixture.userId,
            organizationId: fixture.organizationId,
            locale: "de",
          });
      },
      sequentialLayers: 4,
    },
    {
      name: "completeWorkflow",
      create() {
        const reader = createBenchmarkReleaseReader();
        const pageReader = createDatabaseGapPageReader(reader);
        return () =>
          getGapAnalysisWorkflow(
            {
              userId: fixture.userId,
              organizationId: fixture.organizationId,
              locale: "de",
            },
            pageReader,
          );
      },
      sequentialLayers: 5,
    },
    {
      name: "documentLibrary",
      create: () => () =>
        getOrganizationDocumentLibrary(
          fixture.userId,
          fixture.organizationId,
        ),
      sequentialLayers: 3,
    },
    {
      name: "gapPrerequisite",
      create() {
        const reader = createBenchmarkReleaseReader();
        let release: LoadedGapRelease | null = null;
        return async () => {
          release ??= await reader.getActive({
            releaseCode: "nis2-gap",
            locale: "de",
          });
          return release
            ? postgresGapPageData.loadGapPrerequisiteState(
                {
                  organizationId: fixture.organizationId,
                  locale: "de",
                },
                release,
              )
            : null;
        };
      },
      sequentialLayers: 1,
    },
    {
      name: "gapHistory",
      create: () => () =>
        loadGapHistoryPreauthorized({
          organizationId: fixture.organizationId,
          currentUserId: fixture.userId,
          locale: "de",
        }),
      sequentialLayers: 1,
    },
    ...(fixture.revisionId
      ? [
          {
            name: "generatedInputs",
            create: () => () =>
              readGeneratedGapInputs({
                organizationId: fixture.organizationId,
                revisionId: fixture.revisionId!,
                locale: "de",
              }),
      sequentialLayers: 4,
          },
        ]
      : []),
    {
      name: "activeRelease",
      create() {
        const reader = createBenchmarkReleaseReader();
        return () =>
          reader.getActive({ releaseCode: "nis2-gap", locale: "de" });
      },
      sequentialLayers: 2,
    },
    {
      name: "reassessmentDraft",
      create: () => () =>
        getGapReassessmentDraft({
          userId: fixture.userId,
          organizationId: fixture.organizationId,
          assessmentId: fixture.assessmentId,
          locale: "de",
        }),
      sequentialLayers: 3,
    },
    ...(fixture.revisionId
      ? [
          {
            name: "revisionStaleness",
            create: () => () =>
              getGapRevisionStaleness({
                userId: fixture.userId,
                organizationId: fixture.organizationId,
                revisionId: fixture.revisionId!,
              }),
            sequentialLayers: 3,
          },
        ]
      : []),
  ];
}

function createBenchmarkReleaseReader() {
  const cache = new Map<string, LoadedGapRelease>();
  return createGapReleaseReader({
    async loadPublished(input) {
      const key = `${input.releaseId}\u0000${input.locale}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const loaded = await directGapReleaseReader.getPublished(input);
      if (loaded) cache.set(key, loaded);
      return loaded;
    },
    loadActivePointer: loadActiveGapAnalysisReleasePointer,
  });
}

async function resolveFixture(): Promise<Fixture> {
  const organizationId =
    argumentsByName.get("organization-id") ??
    process.env.GAP_BENCHMARK_ORGANIZATION_ID;
  const userId =
    argumentsByName.get("user-id") ?? process.env.GAP_BENCHMARK_USER_ID;
  const requested = organizationId && userId;
  const rows = await db.execute<{
    organization_id: string;
    user_id: string;
    assessment_id: string;
    revision_id: string | null;
  }>(sql`
    select
      assessment.organization_id,
      membership.user_id,
      assessment.id as assessment_id,
      coalesce(artifact.current_revision_id, artifact.accepted_revision_id)
        as revision_id
    from assessments assessment
    inner join active_gap_analysis_releases active_release
      on active_release.gap_analysis_release_id =
        assessment.gap_analysis_release_id
    inner join organization_memberships membership
      on membership.organization_id = assessment.organization_id
      and membership.status = 'active'
    inner join organizations organization
      on organization.id = assessment.organization_id
    left join generated_artifacts artifact
      on artifact.organization_id = assessment.organization_id
      and artifact.module_id = assessment.module_id
      and artifact.artifact_type = 'gap_analysis_result'
    where assessment.status = 'active'
      ${requested
        ? sql`and assessment.organization_id = ${organizationId}
            and membership.user_id = ${userId}`
        : sql``}
    order by
      (coalesce(artifact.current_revision_id, artifact.accepted_revision_id)
        is not null) desc,
      assessment.created_at desc
    limit 1
  `);
  const row = rows[0];
  if (!row) throw new Error("No eligible Gap benchmark fixture is available");
  return {
    organizationId: row.organization_id,
    userId: row.user_id,
    assessmentId: row.assessment_id,
    revisionId: row.revision_id,
  };
}

async function measure(run: () => Promise<unknown>) {
  const before = await readDatabaseStats();
  const queries: string[] = [];
  setDbQueryObserver((query) => queries.push(query));
  const startedAt = performance.now();
  try {
    const value = await run();
    const wallMs = performance.now() - startedAt;
    setDbQueryObserver();
    const after = await readDatabaseStats();
    return {
      value,
      wallMs,
      queries,
      sqlCalls: queries.length,
      authorizationCalls: queries.filter((query) =>
        query.includes('"organization_memberships"'),
      ).length,
      activePointerCalls: queries.filter((query) =>
        query.includes('"active_gap_analysis_releases"'),
      ).length,
      immutableReleaseAssemblies: queries.filter((query) =>
        query.includes('from "gap_analysis_releases"') &&
        !query.includes('left join "assessments"'),
      ).length,
      databaseExecutionMs:
        before && after ? Math.max(0, after.executionMs - before.executionMs) : null,
    };
  } finally {
    setDbQueryObserver();
  }
}

async function readDatabaseStats(): Promise<DatabaseStats | null> {
  if (databaseStatsAvailable === false) return null;
  try {
    const rows = await db.execute<{
      calls: number;
      execution_ms: number;
    }>(sql`
      select
        coalesce(sum(calls), 0)::float8 as calls,
        coalesce(sum(total_exec_time), 0)::float8 as execution_ms
      from pg_stat_statements
      where dbid = (select oid from pg_database where datname = current_database())
        and userid = (select usesysid from pg_user where usename = current_user)
        and query not ilike '%pg_stat_statements%'
    `);
    databaseStatsAvailable = true;
    return {
      calls: Number(rows[0]?.calls ?? 0),
      executionMs: Number(rows[0]?.execution_ms ?? 0),
    };
  } catch {
    databaseStatsAvailable = false;
    return null;
  }
}

function summarize(name: string, value: unknown) {
  if (name === "gapPage" || name === "completeWorkflow") {
    const workflow = value as {
      release: unknown;
      assessment: unknown;
      documents: unknown[];
      findings: unknown[];
      reassessment: unknown;
    };
    return {
      hasRelease: Boolean(workflow.release),
      hasAssessment: Boolean(workflow.assessment),
      documentCount: workflow.documents.length,
      findingCount: workflow.findings.length,
      hasReassessment: Boolean(workflow.reassessment),
    };
  }
  if (name === "documentsPage") {
    const page = value as {
      assessmentId: string | null;
      documentLibrary: { documents: unknown[] };
      reassessment: unknown;
    };
    return {
      hasAssessment: Boolean(page.assessmentId),
      documentCount: page.documentLibrary.documents.length,
      hasReassessment: Boolean(page.reassessment),
    };
  }
  if (name === "documentLibrary") {
    return {
      documentCount: (value as { documents: unknown[] }).documents.length,
    };
  }
  return { available: value !== null && value !== undefined };
}

function reportSample(
  sample: Awaited<ReturnType<typeof measure>>,
  sequentialLayers?: number,
) {
  return {
    wallMs: round(sample.wallMs),
    sqlCalls: sample.sqlCalls,
    sequentialLayers,
    postgresqlExecutionMs:
      sample.databaseExecutionMs === null
        ? null
        : round(sample.databaseExecutionMs),
    activePointerCalls: sample.activePointerCalls,
    authorizationCalls: sample.authorizationCalls,
    immutableReleaseAssemblies: sample.immutableReleaseAssemblies,
    ...(argumentsByName.has("include-query-shapes")
      ? {
          queryShapes: sample.queries.map((query) =>
            query.replace(/\s+/g, " ").trim(),
          ),
        }
      : {}),
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
    const cause =
      error &&
      typeof error === "object" &&
      "cause" in error &&
      error.cause instanceof Error
        ? `: ${error.cause.message}`
        : "";
    console.error(
      error instanceof Error
        ? `${error.message}${cause}`
        : "Gap workflow benchmark failed",
    );
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
