import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  migration: {} as Record<string, unknown>,
  versions: [] as Array<Record<string, unknown>>,
  migrationUpdates: [] as Array<Record<string, unknown>>,
  organizationUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/src/db", () => {
  const selectBuilder = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["from", "where", "orderBy"]) {
      builder[method] = () => builder;
    }
    builder.then = (
      resolve: (value: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject);
    return builder;
  };
  const updateFor = (sink: Array<Record<string, unknown>>) => ({
    set: (values: Record<string, unknown>) => {
      sink.push(values);
      return { where: async () => undefined };
    },
  });
  // Only the migrations table carries toProviderMode, so it identifies the
  // target without depending on drizzle internals.
  const sinkFor = (table: unknown) =>
    updateFor(
      table && typeof table === "object" && "toProviderMode" in table
        ? state.migrationUpdates
        : state.organizationUpdates,
    );

  return {
    db: {
      query: {
        organizationEmbeddingMigrations: {
          findFirst: async () => state.migration,
        },
      },
      // Only two selects run: the job row for the requester, then the
      // versions still needing a rebuild.
      select: (() => {
        let call = 0;
        return () => {
          call += 1;
          return call === 1
            ? selectBuilder([{ requestedBy: "user-1" }])
            : selectBuilder(state.versions);
        };
      })(),
      update: (table: unknown) => sinkFor(table),
      transaction: async (run: (tx: unknown) => Promise<unknown>) =>
        run({
          update: (table: unknown) => sinkFor(table),
          insert: () => ({ values: async () => undefined }),
        }),
    },
  };
});

vi.mock("@/src/server/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      from: () => ({
        download: async () => ({ data: { arrayBuffer: async () => new ArrayBuffer(4) }, error: null }),
      }),
    },
  }),
}));

import { executeOrganizationReembeddingJob } from "@/src/server/documents/service";

describe("organization re-embedding job", () => {
  beforeEach(() => {
    state.migration = {
      id: "migration-1",
      organizationId: "org-1",
      toProviderMode: "self_hosted",
      fromProviderMode: "openai",
      status: "pending",
      documentVersionsCompleted: 0,
      startedAt: null,
    };
    state.versions = [];
    state.migrationUpdates = [];
    state.organizationUpdates = [];
  });

  it("commits the provider when there is nothing left to rebuild", async () => {
    // The version query already excludes rows on the target model, so an empty
    // result means the rebuild is finished -- including on a resumed attempt.
    state.versions = [];

    const result = await executeOrganizationReembeddingJob({
      organizationId: "org-1",
      migrationId: "migration-1",
      jobId: "job-1",
    });

    expect(result).toEqual({ type: "organization", id: "org-1" });
    expect(state.organizationUpdates).toContainEqual(
      expect.objectContaining({ aiProviderMode: "self_hosted" }),
    );
    expect(state.migrationUpdates).toContainEqual(
      expect.objectContaining({ status: "succeeded" }),
    );
  });

  it("returns the migration to pending when the drain window closes", async () => {
    state.versions = [
      { id: "v1", storageBucket: "organization-evidence", storageKey: "a.txt" },
    ];
    const controller = new AbortController();
    controller.abort();

    await expect(
      executeOrganizationReembeddingJob(
        { organizationId: "org-1", migrationId: "migration-1", jobId: "job-1" },
        controller.signal,
      ),
    ).rejects.toBeDefined();

    // An abort is a bounded window, not a fault: the migration stays active so
    // the next drain resumes it, and the provider must not advance.
    expect(state.migrationUpdates).toContainEqual({ status: "pending" });
    expect(state.migrationUpdates).not.toContainEqual(
      expect.objectContaining({ status: "failed" }),
    );
    expect(state.organizationUpdates).not.toContainEqual(
      expect.objectContaining({ aiProviderMode: "self_hosted" }),
    );
  });

  it("counts resumed progress from what a previous attempt completed", async () => {
    state.migration = { ...state.migration, documentVersionsCompleted: 3 };
    state.versions = [
      { id: "v4", storageBucket: "organization-evidence", storageKey: "d.txt" },
    ];

    await executeOrganizationReembeddingJob({
      organizationId: "org-1",
      migrationId: "migration-1",
      jobId: "job-1",
    }).catch(() => undefined);

    expect(state.migrationUpdates[0]).toMatchObject({
      status: "processing",
      documentVersionsTotal: 4,
      documentVersionsCompleted: 3,
    });
  });

  it("keeps a genuine failure terminal", async () => {
    // The real indexer runs and rejects the stub payload, which is a genuine
    // fault rather than an abort, so the migration must end terminal.
    state.versions = [
      { id: "v1", storageBucket: "organization-evidence", storageKey: "a.txt" },
    ];

    await expect(
      executeOrganizationReembeddingJob({
        organizationId: "org-1",
        migrationId: "migration-1",
        jobId: "job-1",
      }),
    ).rejects.toBeDefined();

    expect(state.migrationUpdates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        failureCode: "ORGANIZATION_REEMBEDDING_FAILED",
      }),
    );
    expect(state.organizationUpdates).not.toContainEqual(
      expect.objectContaining({ aiProviderMode: "self_hosted" }),
    );
  });
});
