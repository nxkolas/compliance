import { apiRateLimitWindows } from "@/src/db/schema";
import type { RateLimitStore } from "@/src/server/platform/http/rate-limit";
import { sql } from "drizzle-orm";

export const databaseRateLimitStore: RateLimitStore = {
  async increment(key, windowStartedAt, expiresAt) {
    const { db } = await import("@/src/db");
    const [row] = await db
      .insert(apiRateLimitWindows)
      .values({ key, windowStartedAt, expiresAt, requestCount: 1 })
      .onConflictDoUpdate({
        target: [apiRateLimitWindows.key, apiRateLimitWindows.windowStartedAt],
        set: {
          requestCount: sql`${apiRateLimitWindows.requestCount} + 1`,
        },
      })
      .returning({ count: apiRateLimitWindows.requestCount });
    return row.count;
  },
};
