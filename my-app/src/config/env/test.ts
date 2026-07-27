import * as z from "zod";
import { parseEnvironment } from "./common";

export const acceptanceEnvironmentSchema = z.object({
  APP_ENV: z.literal("test"),
  COMPOSE_PROJECT_NAME: z.literal("compliancetool-test"),
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
