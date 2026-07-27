import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseEnvironment } from "@/src/config/env/supabase";
import { ApiError } from "./errors";

export async function requireApiUser() {
  try {
    getPublicSupabaseEnvironment();
  } catch {
    throw new ApiError(503, "Authentication service unavailable");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.is_anonymous) {
    throw new ApiError(401, "Authentication required");
  }

  if (user.email) {
    const { syncAuthenticatedUser } = await import("@/src/server/users");
    await syncAuthenticatedUser(user);
  }
  return user;
}
