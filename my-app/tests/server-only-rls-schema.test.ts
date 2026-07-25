import { getTableName, is, Table } from "drizzle-orm";
import { type AnyPgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/src/db/schema";

describe("server-only RLS schema", () => {
  it("enables RLS with no browser policies on every Drizzle table", () => {
    const schemaValues: unknown[] = Object.values(schema);
    const tables = schemaValues
      .filter((value): value is AnyPgTable => is(value, Table))
      .sort((left, right) => getTableName(left).localeCompare(getTableName(right)));

    expect(tables).toHaveLength(128);

    for (const table of tables) {
      const config = getTableConfig(table);

      expect(
        config.enableRLS,
        `${getTableName(table)} must enable RLS`,
      ).toBe(true);
      expect(
        config.policies,
        `${getTableName(table)} must remain browser-inaccessible`,
      ).toEqual([]);
    }
  });
});
