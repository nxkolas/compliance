import { createClient } from "@/lib/supabase/server";
import { ApiError } from "./errors";

export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError(401, "Authentication required");
  }

  return user;
}
