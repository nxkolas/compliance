import "dotenv/config";
import postgres from "postgres";

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");

async function main() {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  await client.unsafe("begin");
  try {
    const [search] = await client<{
      documentMismatches: number;
      legalMismatches: number;
    }[]>`
      select
        (select count(*)::int from document_chunks
          where search_vector is distinct from to_tsvector('simple', coalesce(text, '')))
          as "documentMismatches",
        (select count(*)::int from legal_source_chunks
          where search_vector is distinct from to_tsvector('simple', coalesce(text, '')))
          as "legalMismatches"
    `;
    if (!search || search.documentMismatches || search.legalMismatches) {
      throw new Error("A generated search vector does not match its source text");
    }
    await client.unsafe(`
      do $audit_verification$
      declare
        platform_id uuid;
        organization_event_id uuid;
        organization_id uuid;
        blocked integer := 0;
      begin
        insert into organizations(name, legal_name, country_code, ai_provider_mode)
          values ('Rollback-only connected verification', null, 'DE', 'self_hosted')
          returning id into organization_id;
        insert into platform_audit_events(operator_identity, event_type, entity_type, entity_id)
          values ('connected-verifier', 'verification.created', 'verification', 'rollback-only')
          returning id into platform_id;
        insert into audit_events(organization_id, event_type, entity_type, entity_id)
          values (organization_id, 'verification.created', 'verification', 'rollback-only')
          returning id into organization_event_id;
        begin update platform_audit_events set event_type = 'verification.changed' where id = platform_id;
        exception when sqlstate '55000' then blocked := blocked + 1; end;
        begin delete from platform_audit_events where id = platform_id;
        exception when sqlstate '55000' then blocked := blocked + 1; end;
        begin update audit_events set event_type = 'verification.changed' where id = organization_event_id;
        exception when sqlstate '55000' then blocked := blocked + 1; end;
        begin delete from audit_events where id = organization_event_id;
        exception when sqlstate '55000' then blocked := blocked + 1; end;
        if blocked <> 4 then
          raise exception 'Append-only audit verification blocked % of 4 mutations', blocked;
        end if;
      end
      $audit_verification$;
    `);
    console.log("Verified generated search-vector values and both append-only audit streams in a rollback-only transaction.");
  } finally {
    await client.unsafe("rollback").catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
