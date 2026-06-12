import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Server-component guard that returns the Supabase user or redirects to login.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  if (user.is_anonymous) {
    redirect("/check");
  }

  return user;
}
