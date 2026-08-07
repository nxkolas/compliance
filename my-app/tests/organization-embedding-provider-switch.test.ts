import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  organization: { aiProviderMode: "openai" as string },
  activeMigration: null as Record<string, unknown> | null,
  indexedDocumentVersions: [] as Array<{ id: string }>,
  organizationUpdates: [] as Array<Record<string, unknown>>,
  insertedMigrations: [] as Array<Record<string, unknown>>,
  enqueued: [] as Array<Record<string, unknown>>,
}));

const executor = vi.hoisted(() => ({
  query: {
    organizations: {
      findFirst: async () => mocks.organization,
    },
  },
  select: () => {
    const builder: Record<string, unknown> = {};
    builder.from = () => builder;
    builder.where = () => builder;
    builder.orderBy = () => builder;
    builder.limit = () =>
      Promise.resolve(mocks.activeMigration ? [mocks.activeMigration] : []);
    builder.then = (
      resolve: (rows: unknown[]) => unknown,
      reject?: (error: unknown) => unknown,
    ) => Promise.resolve(mocks.indexedDocumentVersions).then(resolve, reject);
    return builder;
  },
  update: () => ({
    set: (values: Record<string, unknown>) => {
      mocks.organizationUpdates.push(values);
      return {
        where: () => ({
          returning: async () => [
            { id: "org", countryCode: "DE", aiProviderMode: mocks.organization.aiProviderMode },
          ],
        }),
      };
    },
  }),
  insert: () => ({
    values: (values: Record<string, unknown>) => {
      if ("toProviderMode" in values) mocks.insertedMigrations.push(values);
      return Object.assign(Promise.resolve(), {
        returning: async () => [{ id: "migration-1" }],
      });
    },
  }),
}));

vi.mock("@/src/db", () => ({ db: executor }));
vi.mock("@/src/server/jobs", () => ({
  enqueueJob: vi.fn(async (command: Record<string, unknown>) => {
    mocks.enqueued.push(command);
  }),
}));

import { requestEmbeddingConfigChange } from "@/src/server/organizations/embedding-migration-service";
import {
  resolveEmbeddingConfig,
  withEmbeddingKey,
} from "@/src/server/documents/document-config";

describe("organization embedding configuration change", () => {
  beforeEach(() => {
    mocks.organization = { aiProviderMode: "openai" };
    mocks.activeMigration = null;
    mocks.indexedDocumentVersions = [];
    mocks.organizationUpdates = [];
    mocks.insertedMigrations = [];
    mocks.enqueued = [];
  });

  it("stages the change and leaves the committed configuration alone when documents exist", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }, { id: "v2" }];

    const result = await requestEmbeddingConfigChange({
      userId: "user",
      organizationId: "org",
      targetConfig: resolveEmbeddingConfig("self_hosted"),
      executor: executor as never,
    });

    // The stored configuration names the vectors on disk. Advancing it before
    // they are rebuilt is exactly the divergence this design removes.
    expect(result.applied).toBe(false);
    expect(mocks.organizationUpdates).toHaveLength(0);
    expect(mocks.insertedMigrations[0]).toMatchObject({
      fromProviderMode: "openai",
      toProviderMode: "self_hosted",
      fromEmbeddingKey: resolveEmbeddingConfig("openai").key,
      toEmbeddingKey: resolveEmbeddingConfig("self_hosted").key,
      status: "pending",
      documentVersionsTotal: 2,
    });
    expect(mocks.enqueued[0]).toMatchObject({
      kind: "organization_reembedding",
      organizationId: "org",
      payload: { migrationId: "migration-1" },
    });
  });

  /**
   * The regression this phase exists to prevent. Before the key, invalidation
   * compared provider modes, so a model change within one provider returned
   * early -- leaving every stored vector labelled with a space it was no longer
   * in, with no re-index and no error.
   */
  it("stages a migration when only the model changed within one provider", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }];
    const current = resolveEmbeddingConfig("openai");

    const result = await requestEmbeddingConfigChange({
      userId: "user",
      organizationId: "org",
      targetConfig: withEmbeddingKey({ ...current, model: "text-embedding-3-large" }),
      executor: executor as never,
    });

    expect(result.applied).toBe(false);
    expect(mocks.insertedMigrations[0]).toMatchObject({
      fromEmbeddingKey: current.key,
      status: "pending",
    });
    expect(mocks.enqueued[0]).toMatchObject({ kind: "organization_reembedding" });
  });

  it("stages a migration when only the query instruction profile changed", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }];
    const current = resolveEmbeddingConfig("openai");

    const result = await requestEmbeddingConfigChange({
      userId: "user",
      organizationId: "org",
      targetConfig: withEmbeddingKey({
        ...current,
        retrievalInstructionId: "e5-query-v1",
      }),
      executor: executor as never,
    });

    expect(result.applied).toBe(false);
    expect(mocks.enqueued).toHaveLength(1);
  });

  it("commits immediately when the organization has no indexed documents", async () => {
    mocks.indexedDocumentVersions = [];

    const result = await requestEmbeddingConfigChange({
      userId: "user",
      organizationId: "org",
      targetConfig: resolveEmbeddingConfig("self_hosted"),
      executor: executor as never,
    });

    expect(result.applied).toBe(true);
    expect(mocks.organizationUpdates[0]).toMatchObject({
      aiProviderMode: "self_hosted",
    });
    expect(mocks.insertedMigrations[0]).toMatchObject({
      toProviderMode: "self_hosted",
      status: "succeeded",
      documentVersionsTotal: 0,
    });
    expect(mocks.enqueued).toHaveLength(0);
  });

  it("is a no-op when the requested configuration is already committed", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }];

    const result = await requestEmbeddingConfigChange({
      userId: "user",
      organizationId: "org",
      targetConfig: resolveEmbeddingConfig("openai"),
      executor: executor as never,
    });

    expect(result.applied).toBe(true);
    expect(mocks.organizationUpdates).toHaveLength(0);
    expect(mocks.insertedMigrations).toHaveLength(0);
    expect(mocks.enqueued).toHaveLength(0);
  });

  it("rejects a second change while one is still running", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }];
    mocks.activeMigration = {
      id: "migration-0",
      toProviderMode: "self_hosted",
      toEmbeddingKey: resolveEmbeddingConfig("self_hosted").key,
      status: "processing",
      documentVersionsTotal: 1,
      documentVersionsCompleted: 0,
    };

    await expect(
      requestEmbeddingConfigChange({
        userId: "user",
        organizationId: "org",
        targetConfig: resolveEmbeddingConfig("self_hosted"),
        executor: executor as never,
      }),
    ).rejects.toMatchObject({ code: "EMBEDDING_PROVIDER_CHANGE_IN_PROGRESS" });
    expect(mocks.enqueued).toHaveLength(0);
    expect(mocks.organizationUpdates).toHaveLength(0);
  });
});
