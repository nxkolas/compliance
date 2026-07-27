import * as z from "zod";
import {
  commonApplicationEnvironmentSchema,
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
