import * as z from "zod";
import {
  commonApplicationEnvironmentSchema,
  booleanFromEnvironment,
  optionalString,
  parseEnvironment,
} from "./common";

export const webEnvironmentSchema = commonApplicationEnvironmentSchema
  .safeExtend({
    APP_PUBLIC_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
    SUPABASE_INTERNAL_URL: z.url().optional(),
    SUPABASE_SECRET_KEY: z.string().trim().min(1),
    API_CURSOR_SECRET: z.string().trim().min(16).optional(),
    JOB_RECOVERY_ENABLED: booleanFromEnvironment.default(false),
    CRON_SECRET: optionalString,
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV !== "production") {
      return;
    }

    const publicUrl = new URL(environment.APP_PUBLIC_URL);
    if (
      publicUrl.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "::1"].includes(publicUrl.hostname)
    ) {
      context.addIssue({
        code: "custom",
        path: ["APP_PUBLIC_URL"],
        message: "must be a public HTTPS URL in production",
      });
    }

    if (!environment.API_CURSOR_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["API_CURSOR_SECRET"],
        message: "is required in production",
      });
    }

    if (environment.JOB_RECOVERY_ENABLED && !environment.CRON_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "is required when recovery execution is enabled",
      });
    }

    if (
      environment.DEPLOYMENT_TOPOLOGY === "managed_cloud" &&
      !environment.JOB_RECOVERY_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["JOB_RECOVERY_ENABLED"],
        message: "must be enabled for managed-cloud durable job recovery",
      });
    }

    if (environment.DEPLOYMENT_TOPOLOGY === "managed_cloud") {
      for (const [name, value] of [
        ["NEXT_PUBLIC_SUPABASE_URL", environment.NEXT_PUBLIC_SUPABASE_URL],
        ["SUPABASE_INTERNAL_URL", environment.SUPABASE_INTERNAL_URL],
      ] as const) {
        if (!value) continue;
        const url = new URL(value);
        if (
          url.protocol !== "https:" ||
          ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
        ) {
          context.addIssue({
            code: "custom",
            path: [name],
            message: "must use a non-local HTTPS endpoint in managed cloud",
          });
        }
      }
    }

    if (
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ===
      environment.SUPABASE_SECRET_KEY
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_SECRET_KEY"],
        message: "must differ from the publishable key",
      });
    }
  });

export type WebEnvironment = z.output<typeof webEnvironmentSchema>;

export function getWebEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): WebEnvironment {
  return parseEnvironment(webEnvironmentSchema, values);
}
