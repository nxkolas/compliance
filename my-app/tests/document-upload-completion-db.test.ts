import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { PreparedUploadCompletion } from "@/src/server/platform/storage";

const isDisposableDatabase =
  process.env.APP_ENV === "test" &&
  process.env.DISPOSABLE_DATABASE === "1";
const databaseUrl = isDisposableDatabase ? process.env.DATABASE_URL : undefined;
const adminDatabaseUrl = isDisposableDatabase
  ? process.env.DRIZZLE_DATABASE_URL
  : undefined;

describe.runIf(Boolean(databaseUrl && adminDatabaseUrl))("atomic document-upload completion", () => {
  const sql = postgres(databaseUrl!, { prepare: false, max: 3 });
  const adminSql = postgres(adminDatabaseUrl!, { prepare: false, max: 1 });
  const organizationIds: string[] = [];

  afterEach(async () => {
    for (const organizationId of organizationIds) {
      await adminSql`set session_replication_role = replica`;
      try {
        await adminSql`delete from audit_events where organization_id = ${organizationId}`;
      } finally {
        await adminSql`set session_replication_role = origin`;
      }
      await adminSql`delete from organizations where id = ${organizationId}`;
    }
    organizationIds.length = 0;
  });

  afterAll(async () => {
    await sql.end();
    await adminSql.end();
    const { closeDbConnection } = await import("@/src/db");
    await closeDbConnection();
  });

  it("commits one artifact set and replays the stored immutable version", async () => {
    const fixture = await createUploadedSession();
    const { finalizeDocumentUpload } = await import("@/src/server/modules/documents");

    const first = await finalizeDocumentUpload({
      upload: fixture.upload,
      title: "Incident response policy",
    });
    const replay = await finalizeDocumentUpload({
      upload: fixture.upload,
      title: "Incident response policy",
    });

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    await expectArtifactCounts(fixture, first.documentVersionId);
  });

  it("serializes concurrent completion without duplicate artifacts", async () => {
    const fixture = await createUploadedSession();
    const { finalizeDocumentUpload } = await import("@/src/server/modules/documents");

    const results = await Promise.all([
      finalizeDocumentUpload({ upload: fixture.upload, title: "Security policy" }),
      finalizeDocumentUpload({ upload: fixture.upload, title: "Security policy" }),
    ]);

    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.replayed)).toHaveLength(1);
    expect(new Set(results.map((result) => result.documentVersionId))).toHaveProperty("size", 1);
    await expectArtifactCounts(fixture, results[0]!.documentVersionId);
  });

  it("rolls back every artifact when the final audit write fails", async () => {
    const fixture = await createUploadedSession();
    const { finalizeDocumentUpload } = await import("@/src/server/modules/documents");
    const suffix = randomUUID().replaceAll("-", "_");
    const functionName = `fail_atomic_upload_audit_${suffix}`;
    const triggerName = `fail_atomic_upload_audit_${suffix}`;

    await adminSql.unsafe(`
      create function ${functionName}() returns trigger language plpgsql as $$
      begin
        if new.organization_id = '${fixture.organizationId}'::uuid then
          raise exception 'injected audit failure';
        end if;
        return new;
      end
      $$
    `);
    try {
      await adminSql.unsafe(`
        create trigger ${triggerName}
        before insert on audit_events
        for each row execute function ${functionName}()
      `);
      await expect(finalizeDocumentUpload({
        upload: fixture.upload,
        title: "Rollback policy",
      })).rejects.toThrow("injected audit failure");
    } finally {
      await adminSql.unsafe(`drop trigger if exists ${triggerName} on audit_events`);
      await adminSql.unsafe(`drop function if exists ${functionName}()`);
    }

    const [rolledBack] = await sql<{
      documents: number;
      versions: number;
      jobs: number;
      audits: number;
      uploaded_sessions: number;
    }[]>`
      select
        (select count(*)::int from documents where organization_id = ${fixture.organizationId}) as documents,
        (select count(*)::int from document_versions where organization_id = ${fixture.organizationId}) as versions,
        (select count(*)::int from background_jobs where organization_id = ${fixture.organizationId}) as jobs,
        (select count(*)::int from audit_events where organization_id = ${fixture.organizationId}) as audits,
        (select count(*)::int from upload_sessions where id = ${fixture.sessionId} and state = 'uploaded' and result_locator is null) as uploaded_sessions
    `;
    expect(rolledBack).toEqual({
      documents: 0,
      versions: 0,
      jobs: 0,
      audits: 0,
      uploaded_sessions: 1,
    });

    const retry = await finalizeDocumentUpload({
      upload: fixture.upload,
      title: "Rollback policy",
    });
    expect(retry.replayed).toBe(false);
    await expectArtifactCounts(fixture, retry.documentVersionId);
  });

  async function createUploadedSession() {
    const organizationId = randomUUID();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const contentHash = createHash("sha256").update("verified document").digest("hex");
    const expiresAt = new Date(Date.now() + 60_000);
    const storageBucket = "organization-evidence";
    const storageKey = `document/${organizationId}/${sessionId}/policy.pdf`;
    organizationIds.push(organizationId);

    await sql`insert into organizations (id, name) values (${organizationId}, ${`Atomic upload ${organizationId}`})`;
    await sql`
      insert into upload_sessions (
        id, organization_id, state, storage_bucket, storage_key, file_name,
        mime_type, expected_byte_size, expected_hash, requested_by, expires_at
      ) values (
        ${sessionId}, ${organizationId}, 'uploaded', ${storageBucket}, ${storageKey},
        'policy.pdf', 'application/pdf', 17, ${contentHash}, ${userId}, ${expiresAt}
      )
    `;

    const upload: PreparedUploadCompletion = {
      kind: "verified",
      sessionId,
      organizationId,
      requestedBy: userId,
      storageBucket,
      storageKey,
      fileName: "policy.pdf",
      mimeType: "application/pdf",
      expectedByteSize: 17,
      expectedHash: contentHash,
      expiresAt,
      object: {
        byteSize: 17,
        mimeType: "application/pdf",
        contentHash,
      },
    };
    return { organizationId, sessionId, upload };
  }

  async function expectArtifactCounts(
    fixture: Awaited<ReturnType<typeof createUploadedSession>>,
    versionId: string,
  ) {
    const [counts] = await sql<{
      documents: number;
      versions: number;
      jobs: number;
      audits: number;
      completed_sessions: number;
    }[]>`
      select
        (select count(*)::int from documents where organization_id = ${fixture.organizationId}) as documents,
        (select count(*)::int from document_versions where organization_id = ${fixture.organizationId}) as versions,
        (select count(*)::int from background_jobs where organization_id = ${fixture.organizationId} and kind = 'document_indexing') as jobs,
        (select count(*)::int from audit_events where organization_id = ${fixture.organizationId} and event_type = 'document.uploaded') as audits,
        (select count(*)::int from upload_sessions where id = ${fixture.sessionId} and state = 'completed') as completed_sessions
    `;
    const [session] = await sql<{ result_locator: unknown }[]>`
      select result_locator from upload_sessions where id = ${fixture.sessionId}
    `;

    expect(counts).toEqual({
      documents: 1,
      versions: 1,
      jobs: 1,
      audits: 1,
      completed_sessions: 1,
    });
    expect(session?.result_locator).toEqual({ type: "document_version", id: versionId });
  }
});
