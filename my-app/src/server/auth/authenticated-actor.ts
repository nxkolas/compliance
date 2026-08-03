import { createClient } from "@/lib/supabase/server";
import {
  projectAuthenticatedActor,
  type AuthenticatedActor,
} from "@/src/server/users/projection";

export async function resolveAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || user.is_anonymous) return null;
  return projectAuthenticatedActor(user);
}
