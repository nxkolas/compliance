import { customType, timestamp } from "drizzle-orm/pg-core";

/**
 * An undimensioned pgvector column: each row stores its embedding at whatever
 * width the model that produced it emits.
 *
 * The width is an organization's choice now, so it cannot be fixed in the
 * column. There is no ANN index on this column -- similarity search is a
 * sequential scan -- so declaring no dimension costs nothing today; pgvector
 * only requires a fixed width to build an HNSW or IVFFlat index. Adding one
 * later across heterogeneous widths is the deferred cost of that choice.
 *
 * Comparing two vectors of different widths raises a Postgres error rather than
 * returning a meaningless distance. Retrieval filters on `embedding_key` before
 * any comparison happens, so only rows from one space are ever scored together
 * and that error is unreachable through the application.
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) =>
    value.slice(1, -1).split(",").filter(Boolean).map(Number),
});

export const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
