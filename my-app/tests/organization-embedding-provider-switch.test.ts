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

import { requestProviderChange } from "@/src/server/organizations/embedding-migration-service";

describe("organization provider change", () => {
  beforeEach(() => {
    mocks.organization = { aiProviderMode: "openai" };
    mocks.activeMigration = null;
    mocks.indexedDocumentVersions = [];
    mocks.organizationUpdates = [];
    mocks.insertedMigrations = [];
    mocks.enqueued = [];
  });

  it("stages the change and leaves the committed provider alone when documents exist", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }, { id: "v2" }];

    const result = await requestProviderChange({
      userId: "user",
      organizationId: "org",
      targetProviderMode: "self_hosted",
      executor: executor as never,
    });

    // The provider names the vectors on disk. Advancing it before they are
    // rebuilt is exactly the divergence this design removes.
    expect(result.applied).toBe(false);
    expect(mocks.organizationUpdates).toHaveLength(0);
    expect(mocks.insertedMigrations[0]).toMatchObject({
      fromProviderMode: "openai",
      toProviderMode: "self_hosted",
      status: "pending",
      documentVersionsTotal: 2,
    });
    expect(mocks.enqueued[0]).toMatchObject({
      kind: "organization_reembedding",
      organizationId: "org",
      payload: { migrationId: "migration-1" },
    });
  });

  it("commits immediately when the organization has no indexed documents", async () => {
    mocks.indexedDocumentVersions = [];

    const result = await requestProviderChange({
      userId: "user",
      organizationId: "org",
      targetProviderMode: "self_hosted",
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

  it("is a no-op when the requested provider is already committed", async () => {
    mocks.indexedDocumentVersions = [{ id: "v1" }];

    const result = await requestProviderChange({
      userId: "user",
      organizationId: "org",
      targetProviderMode: "openai",
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
      status: "processing",
      documentVersionsTotal: 1,
      documentVersionsCompleted: 0,
    };

    await expect(
      requestProviderChange({
        userId: "user",
        organizationId: "org",
        targetProviderMode: "company_hosted",
        executor: executor as never,
      }),
    ).rejects.toMatchObject({ code: "EMBEDDING_PROVIDER_CHANGE_IN_PROGRESS" });
    expect(mocks.enqueued).toHaveLength(0);
    expect(mocks.organizationUpdates).toHaveLength(0);
  });
});
