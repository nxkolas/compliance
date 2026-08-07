import * as z from "zod";
import { appEnvironmentSchema, parseEnvironment } from "./common";

export const migrationEnvironmentSchema = z
  .object({
    APP_ENV: appEnvironmentSchema,
    DRIZZLE_DATABASE_URL: z.string().trim().min(1),
    MIGRATION_DATABASE_NAME: z.string().trim().min(1),
    APP_DATABASE_ROLE: z
      .string()
      .trim()
      .regex(/^[a-z_][a-z0-9_]*$/)
      .default("app_runtime"),
    APP_DATABASE_PASSWORD: z.string().min(16),
    MIGRATION_ADVISORY_LOCK_ID: z.coerce
      .number()
      .int()
      .safe()
      .default(7240121536),
    AI_EMBEDDING_DIM: z.coerce.number().int().min(1).max(16000).default(1536),
  })
  .superRefine((environment, context) => {
    let databaseUrl: URL | undefined;
    try {
      databaseUrl = new URL(environment.DRIZZLE_DATABASE_URL);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["DRIZZLE_DATABASE_URL"],
        message: "must be a PostgreSQL URL",
      });
      return;
    }

    if (
      !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
      decodeURIComponent(databaseUrl.pathname.slice(1)) !==
        environment.MIGRATION_DATABASE_NAME
    ) {
      context.addIssue({
        code: "custom",
        path: ["MIGRATION_DATABASE_NAME"],
        message: "must exactly match the database URL target",
      });
    }
  });

export type MigrationEnvironment = z.output<
  typeof migrationEnvironmentSchema
>;

export function getMigrationEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): MigrationEnvironment {
  return parseEnvironment(migrationEnvironmentSchema, values);
}
