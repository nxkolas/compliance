import * as z from "zod";
import { parseEnvironment } from "./common";

const publicSupabaseEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
});

export function getPublicSupabaseEnvironment(
  values: NodeJS.ProcessEnv = process.env,
) {
  return parseEnvironment(publicSupabaseEnvironmentSchema, values);
}

export function getInternalSupabaseEnvironment(
  values: NodeJS.ProcessEnv = process.env,
) {
  const publicEnvironment = getPublicSupabaseEnvironment(values);
  const internalUrl = readDynamicEnvironment(
    values,
    "SUPABASE_INTERNAL_URL",
  );
  return {
    url: internalUrl || publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function serializeBrowserSupabaseEnvironment(
  values: NodeJS.ProcessEnv = process.env,
) {
  const environment = getPublicSupabaseEnvironment(values);
  return JSON.stringify({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).replaceAll("<", "\\u003c");
}

function readDynamicEnvironment(
  values: NodeJS.ProcessEnv,
  name: string,
) {
  const value = values[name]?.trim();
  return value || undefined;
}
