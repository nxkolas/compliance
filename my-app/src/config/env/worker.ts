import * as z from "zod";
import {
  commonApplicationEnvironmentSchema,
  parseEnvironment,
} from "./common";

export const workerEnvironmentSchema = commonApplicationEnvironmentSchema
  .safeExtend({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
    SUPABASE_INTERNAL_URL: z.url().optional(),
    SUPABASE_SECRET_KEY: z.string().trim().min(1),
    WORKER_ID: z.string().trim().min(1).optional(),
    WORKER_DEBUG_ERRORS: z
      .union([z.literal("0"), z.literal("1")])
      .default("0"),
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV === "production" && !environment.WORKER_ID) {
      context.addIssue({
        code: "custom",
        path: ["WORKER_ID"],
        message: "is required in production",
      });
    }

    if (
      environment.APP_ENV === "production" &&
      environment.WORKER_DEBUG_ERRORS !== "0"
    ) {
      context.addIssue({
        code: "custom",
        path: ["WORKER_DEBUG_ERRORS"],
        message: "must be disabled in production",
      });
    }
  });

export type WorkerEnvironment = z.output<typeof workerEnvironmentSchema>;

export function getWorkerEnvironment(
  values: NodeJS.ProcessEnv = process.env,
): WorkerEnvironment {
  return parseEnvironment(workerEnvironmentSchema, values);
}
