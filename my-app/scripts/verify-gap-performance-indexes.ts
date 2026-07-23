import "dotenv/config";

import { sql } from "drizzle-orm";
import { closeDbConnection, db } from "../src/db";

const expected = new Map([
  [
    "documents_organization_created_idx",
    ["organization_id", "created_at", "id"],
  ],
  [
    "gap_reassessment_drafts_organization_assessment_created_idx",
    ["organization_id", "assessment_id", "created_at"],
  ],
  [
    "ai_processing_runs_org_assessment_operation_created_idx",
    [
      "organization_id",
      "assessment_revision_id",
      "operation_kind",
      "created_at",
    ],
  ],
  [
    "artifact_revision_sources_revision_type_idx",
    ["artifact_revision_id", "source_type"],
  ],
]);

async function main() {
  if (process.argv.includes("--apply")) {
    await db.execute(sql`
      create index if not exists documents_organization_created_idx
      on documents (organization_id, created_at, id)
    `);
    await db.execute(sql`
      create index if not exists
        gap_reassessment_drafts_organization_assessment_created_idx
      on gap_reassessment_drafts
        (organization_id, assessment_id, created_at)
    `);
    await db.execute(sql`
      create index if not exists
        ai_processing_runs_org_assessment_operation_created_idx
      on ai_processing_runs
        (organization_id, assessment_revision_id, operation_kind, created_at)
    `);
    await db.execute(sql`
      create index if not exists artifact_revision_sources_revision_type_idx
      on artifact_revision_sources (artifact_revision_id, source_type)
    `);
  }

  const rows = await db.execute<{
    index_name: string;
    column_names: string[];
  }>(sql`
    select
      index_class.relname as index_name,
      array_agg(attribute.attname order by key_column.ordinality)
        filter (where key_column.attnum > 0) as column_names
    from pg_index index_definition
    inner join pg_class index_class
      on index_class.oid = index_definition.indexrelid
    inner join pg_class table_class
      on table_class.oid = index_definition.indrelid
    inner join pg_namespace table_namespace
      on table_namespace.oid = table_class.relnamespace
    cross join lateral unnest(index_definition.indkey)
      with ordinality as key_column(attnum, ordinality)
    inner join pg_attribute attribute
      on attribute.attrelid = table_class.oid
      and attribute.attnum = key_column.attnum
    where table_namespace.nspname = 'public'
      and index_class.relname in (
        'documents_organization_created_idx',
        'gap_reassessment_drafts_organization_assessment_created_idx',
        'ai_processing_runs_org_assessment_operation_created_idx',
        'artifact_revision_sources_revision_type_idx'
      )
    group by index_class.relname
    order by index_class.relname
  `);

  const actual = new Map(
    rows.map((row) => [row.index_name, row.column_names]),
  );
  for (const [name, columns] of expected) {
    const actualColumns = actual.get(name);
    if (JSON.stringify(actualColumns) !== JSON.stringify(columns)) {
      throw new Error(
        `${name} has columns ${JSON.stringify(actualColumns ?? null)}; expected ${JSON.stringify(columns)}`,
      );
    }
  }
  console.log(
    JSON.stringify(
      Object.fromEntries(
        [...expected].map(([name]) => [name, actual.get(name)]),
      ),
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
