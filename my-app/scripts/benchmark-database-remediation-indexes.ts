import "dotenv/config";

import postgres from "postgres";

type PlanMetrics = {
  executionMs: number;
  localHitBlocks: number;
  localReadBlocks: number;
  planningMs: number;
  rootNode: string;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
};

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DRIZZLE_DATABASE_URL or DATABASE_URL is required");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to benchmark indexes against a production database");
}

const configuredUrls = [
  process.env.DATABASE_URL,
  process.env.DRIZZLE_DATABASE_URL,
].filter((value): value is string => Boolean(value));
const targets = configuredUrls.map((value) => {
  const url = new URL(value);
  return `${url.hostname}:${url.pathname}`;
});
if (new Set(targets).size > 1) {
  throw new Error("DATABASE_URL and DRIZZLE_DATABASE_URL identify different targets");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

function metrics(rows: postgres.RowList<Record<string, unknown>[]>): PlanMetrics {
  const envelope = rows[0]?.["QUERY PLAN"] as
    | Array<{ Plan: Record<string, unknown>; "Execution Time": number; "Planning Time": number }>
    | undefined;
  if (!envelope?.[0]) throw new Error("PostgreSQL did not return a JSON plan");
  const root = envelope[0].Plan;
  return {
    executionMs: envelope[0]["Execution Time"],
    localHitBlocks: Number(root["Local Hit Blocks"] ?? 0),
    localReadBlocks: Number(root["Local Read Blocks"] ?? 0),
    planningMs: envelope[0]["Planning Time"],
    rootNode: String(root["Node Type"]),
    sharedHitBlocks: Number(root["Shared Hit Blocks"] ?? 0),
    sharedReadBlocks: Number(root["Shared Read Blocks"] ?? 0),
  };
}

async function explain(statement: string) {
  return metrics(
    await sql.unsafe(
      `explain (analyze, buffers, format json) ${statement}`,
    ),
  );
}

async function explainMutation(statement: string) {
  await sql.unsafe("begin");
  try {
    return await explain(statement);
  } finally {
    await sql.unsafe("rollback");
  }
}

async function main() {
  await sql.unsafe(`
    create temp table prefix_index_fixture (
      leading_key bigint not null,
      trailing_key bigint not null,
      payload text not null
    )
  `);
  await sql.unsafe(`
    insert into prefix_index_fixture (leading_key, trailing_key, payload)
    select value % 5000, value, repeat('x', 48)
    from generate_series(1, 250000) value
  `);
  await sql.unsafe(`
    create unique index prefix_fixture_wider_idx
      on prefix_index_fixture (leading_key, trailing_key)
  `);
  await sql.unsafe(`
    create index prefix_fixture_narrow_idx
      on prefix_index_fixture (leading_key)
  `);
  await sql.unsafe("analyze prefix_index_fixture");

  await explain("select * from prefix_index_fixture where leading_key = 4242");
  const prefixWithBoth = {
    read: await explain(
      "select * from prefix_index_fixture where leading_key = 4242",
    ),
    update: await explainMutation(
      "update prefix_index_fixture set payload = payload where leading_key = 4242",
    ),
    delete: await explainMutation(
      "delete from prefix_index_fixture where leading_key = 4242",
    ),
  };

  await sql.unsafe("drop index prefix_fixture_narrow_idx");
  await sql.unsafe("analyze prefix_index_fixture");
  await explain("select * from prefix_index_fixture where leading_key = 4242");
  const prefixWithWiderOnly = {
    read: await explain(
      "select * from prefix_index_fixture where leading_key = 4242",
    ),
    update: await explainMutation(
      "update prefix_index_fixture set payload = payload where leading_key = 4242",
    ),
    delete: await explainMutation(
      "delete from prefix_index_fixture where leading_key = 4242",
    ),
  };

  await sql.unsafe(`
    create temp table prefix_write_both (
      leading_key bigint not null,
      trailing_key bigint not null,
      payload text not null
    )
  `);
  await sql.unsafe(`
    create unique index prefix_write_both_wider_idx
      on prefix_write_both (leading_key, trailing_key)
  `);
  await sql.unsafe(`
    create index prefix_write_both_narrow_idx
      on prefix_write_both (leading_key)
  `);
  const writeWithBoth = await explain(`
    insert into prefix_write_both (leading_key, trailing_key, payload)
    select value % 5000, value, repeat('x', 48)
    from generate_series(1, 100000) value
  `);

  await sql.unsafe(`
    create temp table prefix_write_wider (
      leading_key bigint not null,
      trailing_key bigint not null,
      payload text not null
    )
  `);
  await sql.unsafe(`
    create unique index prefix_write_wider_idx
      on prefix_write_wider (leading_key, trailing_key)
  `);
  const writeWithWiderOnly = await explain(`
    insert into prefix_write_wider (leading_key, trailing_key, payload)
    select value % 5000, value, repeat('x', 48)
    from generate_series(1, 100000) value
  `);

  await sql.unsafe(`
    create temp table fk_index_fixture (
      id bigint generated always as identity primary key,
      target_id bigint not null,
      payload text not null
    )
  `);
  await sql.unsafe(`
    insert into fk_index_fixture (target_id, payload)
    select value % 5000, repeat('y', 48)
    from generate_series(1, 250000) value
  `);
  await sql.unsafe("analyze fk_index_fixture");
  const unsupportedFkWithoutIndex = {
    read: await explain("select * from fk_index_fixture where target_id = 4242"),
    update: await explainMutation(
      "update fk_index_fixture set payload = payload where target_id = 4242",
    ),
    delete: await explainMutation(
      "delete from fk_index_fixture where target_id = 4242",
    ),
  };

  await sql.unsafe(`
    create index fk_index_fixture_target_idx on fk_index_fixture (target_id)
  `);
  await sql.unsafe("analyze fk_index_fixture");
  await explain("select * from fk_index_fixture where target_id = 4242");
  const unsupportedFkWithIndex = {
    read: await explain("select * from fk_index_fixture where target_id = 4242"),
    update: await explainMutation(
      "update fk_index_fixture set payload = payload where target_id = 4242",
    ),
    delete: await explainMutation(
      "delete from fk_index_fixture where target_id = 4242",
    ),
  };

  console.log(JSON.stringify({
    fixture: {
      distinctLeadingOrTargetKeys: 5000,
      rows: 250000,
      writeRows: 100000,
    },
    prefixCandidate: {
      withBothIndexes: prefixWithBoth,
      withWiderIndexOnly: prefixWithWiderOnly,
      writeWithBothIndexes: writeWithBoth,
      writeWithWiderIndexOnly: writeWithWiderOnly,
    },
    unsupportedForeignKey: {
      withIndex: unsupportedFkWithIndex,
      withoutIndex: unsupportedFkWithoutIndex,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
