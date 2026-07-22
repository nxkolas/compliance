import { apiRateLimitWindows } from "@/src/db/schema";
import type { RateLimitStore } from "@/src/server/api/rate-limit";
import { sql } from "drizzle-orm";

export const databaseRateLimitStore: RateLimitStore = {
  async increment(key, windowStartedAt, expiresAt) {
    const { db } = await import("@/src/db");
    const [row] = await db
      .insert(apiRateLimitWindows)
      .values({ key, windowStartedAt, expiresAt, count: 1 })
      .onConflictDoUpdate({
        target: [apiRateLimitWindows.key, apiRateLimitWindows.windowStartedAt],
        set: {
          count: sql`${apiRateLimitWindows.count} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ count: apiRateLimitWindows.count });
    return row.count;
  },
};
