import { getPublicSupabaseEnvironment } from "@/src/config/env/supabase";
import { resolveAuthenticatedActor } from "@/src/server/platform/auth/authenticated-actor";
import { ApiError } from "./errors";

export async function requireApiUser() {
  try {
    getPublicSupabaseEnvironment();
  } catch {
    throw new ApiError(503, "Authentication service unavailable");
  }

  const actor = await resolveAuthenticatedActor();
  if (!actor) {
    throw new ApiError(401, "Authentication required");
  }
  return actor;
}
