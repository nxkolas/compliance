import * as z from "zod";
import { parseEnvironment } from "./common";

/**
 * Guards destructive database tests. These truncate and re-create rows, so they
 * must never point at a database that holds real data. Opting in requires
 * naming the database disposable explicitly rather than inferring it from a
 * connection string.
 */
export const acceptanceEnvironmentSchema = z.object({
  APP_ENV: z.literal("test"),
  DISPOSABLE_DATABASE: z.literal("1"),
  APP_PUBLIC_URL: z.url().default("http://localhost:3000"),
  SUPABASE_PUBLIC_URL: z.url().default("http://localhost:8000"),
});

export type AcceptanceEnvironment = z.output<
  typeof acceptanceEnvironmentSchema
>;

export function getAcceptanceEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): AcceptanceEnvironment {
  return parseEnvironment(acceptanceEnvironmentSchema, values);
}
