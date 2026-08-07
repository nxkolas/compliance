import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  embeddingIdentityKey,
  type EmbeddingCoordinates,
} from "@/src/server/documents/document-config";

const isDisposableDatabase =
  process.env.APP_ENV === "test" && process.env.DISPOSABLE_DATABASE === "1";
const databaseUrl = isDisposableDatabase ? process.env.DATABASE_URL : undefined;

/**
 * Vectors are only comparable within a single embedding configuration.
 * Retrieval must therefore refuse rows produced by a different one instead of
 * scoring them, because a partial or failed re-embedding otherwise mixes two
 * vector spaces and returns confident nonsense with no error anywhere.
 *
 * The filter is on `embedding_key`, which covers the model, its revision, its
 * dimensions, the query instruction profile and the chunking version. Filtering
 * on the model alone would let a revision or instruction change through.
 */
describe.runIf(Boolean(databaseUrl))(
  "document retrieval embedding identity isolation",
  () => {
    const sql = postgres(databaseUrl!, { prepare: false, max: 2 });
    const organizationIds: string[] = [];

    afterEach(async () => {
      for (const organizationId of organizationIds) {
        await sql`set session_replication_role = replica`;
        try {
          await sql`delete from audit_events where organization_id = ${organizationId}`;
        } finally {
          await sql`set session_replication_role = origin`;
        }
        await sql`delete from organizations where id = ${organizationId}`;
      }
      organizationIds.length = 0;
      vi.restoreAllMocks();
    });

    afterAll(async () => {
      await sql.end();
      const { closeDatabaseConnection } = await import(
        "@/src/server/database-lifecycle"
      );
      await closeDatabaseConnection();
    });

    it("returns evidence when the stored identity matches the active embedder", async () => {
      const fixture = await seedIndexedDocument(coordinates());
      const evidence = await retrieve(fixture, coordinates());
      expect(evidence.map((item) => item.documentVersionId)).toEqual([
        fixture.documentVersionId,
      ]);
    });

    it("returns nothing when the stored model differs from the active embedder", async () => {
      const fixture = await seedIndexedDocument(coordinates());
      const evidence = await retrieve(
        fixture,
        coordinates({ model: "qwen3-embedding:4b-q4_K_M" }),
      );
      expect(evidence).toEqual([]);
    });

    /**
     * The regression that motivated keying on identity rather than provider.
     * An organization swapping its local embedding model never changes
     * provider, so a provider comparison would have kept serving vectors from
     * the previous model as though they were comparable.
     */
    it("returns nothing when only the model changed within one provider", async () => {
      const fixture = await seedIndexedDocument(
        coordinates({ provider: "self_hosted", model: "qwen3-embedding:4b" }),
      );
      const evidence = await retrieve(
        fixture,
        coordinates({ provider: "self_hosted", model: "embeddinggemma" }),
      );
      expect(evidence).toEqual([]);
    });

    it("returns nothing when only the query instruction profile changed", async () => {
      const fixture = await seedIndexedDocument(coordinates());
      const evidence = await retrieve(
        fixture,
        coordinates({ retrievalInstructionId: "qwen3-query-v1" }),
      );
      expect(evidence).toEqual([]);
    });

    async function retrieve(
      fixture: { organizationId: string; userId: string; documentVersionId: string },
      active: EmbeddingCoordinates,
    ) {
      const organizations = await import("@/src/server/organizations/service");
      vi.spyOn(organizations, "assertCanAccessOrganization").mockResolvedValue(
        undefined as never,
      );
      const { retrieveDocumentEvidence } = await import(
        "@/src/server/documents/retrieval"
      );
      return retrieveDocumentEvidence(
        {
          userId: fixture.userId,
          organizationId: fixture.organizationId,
          selectedDocumentVersionIds: [fixture.documentVersionId],
          query: "backup retention",
          limit: 5,
        },
        {
          embeddingProvider: {
            ...active,
            key: embeddingIdentityKey(active),
            embed: async () => [unitVector()],
          },
        },
      );
    }

    async function seedIndexedDocument(stored: EmbeddingCoordinates) {
      const organizationId = randomUUID();
      const documentId = randomUUID();
      const documentVersionId = randomUUID();
      const userId = randomUUID();
      organizationIds.push(organizationId);

      await sql`
        insert into organizations (id, name, country_code)
        values (${organizationId}, ${"Retrieval fixture"}, 'DE')`;
      await sql`
        insert into documents (id, organization_id, name, created_by)
        values (${documentId}, ${organizationId}, ${"Backup policy"}, ${userId})`;
      await sql`
        insert into document_versions (
          id, organization_id, document_id, version_number, file_name,
          mime_type, byte_size, storage_bucket, storage_key, content_hash,
          indexing_status, parser, embedding_model, embedding_revision,
          embedding_dimensions, embedding_instruction_profile, embedding_key,
          indexing_completed_at, created_by
        ) values (
          ${documentVersionId}, ${organizationId}, ${documentId}, 1,
          'backup.txt', 'text/plain', 42, 'organization-evidence',
          ${`${organizationId}/backup.txt`}, ${randomUUID()},
          'succeeded', 'text', ${stored.model}, ${stored.modelRevision},
          ${stored.dimensions}, ${stored.retrievalInstructionId},
          ${embeddingIdentityKey(stored)}, now(), ${userId}
        )`;
      await sql`
        update documents set current_version_id = ${documentVersionId}
        where id = ${documentId}`;
      await sql`
        insert into document_chunks (
          organization_id, document_version_id, position, page_number,
          text, content_hash, embedding
        ) values (
          ${organizationId}, ${documentVersionId}, 0, 1,
          ${"Backups must be retained for twelve months."}, ${randomUUID()},
          ${`[${unitVector().join(",")}]`}::extensions.vector
        )`;

      return { organizationId, documentId, documentVersionId, userId };
    }
  },
);

function coordinates(
  overrides: Partial<EmbeddingCoordinates> = {},
): EmbeddingCoordinates {
  return {
    provider: "openai",
    model: "text-embedding-3-small",
    modelRevision: "1",
    dimensions: 1536,
    retrievalInstructionId: "none",
    chunkingVersion: "paragraph-v1",
    ...overrides,
  };
}

function unitVector() {
  const values = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0));
  return values;
}
