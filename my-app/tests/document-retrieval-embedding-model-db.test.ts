import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const isDisposableDatabase =
  process.env.APP_ENV === "test" && process.env.DISPOSABLE_DATABASE === "1";
const databaseUrl = isDisposableDatabase ? process.env.DATABASE_URL : undefined;

/**
 * Vectors are only comparable within a single embedding model. Retrieval must
 * therefore refuse rows produced by a different one instead of scoring them,
 * because a partial or failed re-embedding otherwise mixes two vector spaces
 * and returns confident nonsense with no error anywhere.
 */
describe.runIf(Boolean(databaseUrl))(
  "document retrieval embedding model isolation",
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

    it("returns evidence when the stored model matches the active embedder", async () => {
      const fixture = await seedIndexedDocument("text-embedding-3-small");
      const evidence = await retrieve(fixture, "text-embedding-3-small");
      expect(evidence.map((item) => item.documentVersionId)).toEqual([
        fixture.documentVersionId,
      ]);
    });

    it("returns nothing when the stored model differs from the active embedder", async () => {
      const fixture = await seedIndexedDocument("text-embedding-3-small");
      const evidence = await retrieve(fixture, "qwen3-embedding:4b-q4_K_M");
      expect(evidence).toEqual([]);
    });

    async function retrieve(
      fixture: { organizationId: string; userId: string; documentVersionId: string },
      activeModel: string,
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
            provider: "test",
            model: activeModel,
            modelRevision: "1",
            dimensions: 1536,
            retrievalInstructionId: "none",
            embed: async () => [unitVector()],
          },
        },
      );
    }

    async function seedIndexedDocument(embeddingModel: string) {
      const organizationId = randomUUID();
      const documentId = randomUUID();
      const documentVersionId = randomUUID();
      const userId = randomUUID();
      organizationIds.push(organizationId);

      await sql`
        insert into organizations (id, name, country_code)
        values (${organizationId}, ${"Retrieval fixture"}, 'DE')`;
      await sql`
        insert into documents (id, organization_id, name)
        values (${documentId}, ${organizationId}, ${"Backup policy"})`;
      await sql`
        insert into document_versions (
          id, organization_id, document_id, version_number, file_name,
          mime_type, byte_size, storage_bucket, storage_key, content_hash,
          indexing_status, parser, embedding_model, indexing_completed_at
        ) values (
          ${documentVersionId}, ${organizationId}, ${documentId}, 1,
          'backup.txt', 'text/plain', 42, 'organization-evidence',
          ${`${organizationId}/backup.txt`}, ${randomUUID()},
          'succeeded', 'text', ${embeddingModel}, now()
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

function unitVector() {
  const values = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0));
  return values;
}
