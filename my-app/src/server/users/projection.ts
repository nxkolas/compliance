import type { User } from "@supabase/supabase-js";

export type SafeUserIdentity = {
  userId: string;
  email: string;
  displayName: string | null;
};

export function projectAuthenticatedUser(user: User): SafeUserIdentity | null {
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;
  const candidate = user.user_metadata?.full_name;
  const displayName =
    typeof candidate === "string" && candidate.trim()
      ? candidate.trim().slice(0, 160)
      : null;
  return { userId: user.id, email: email.slice(0, 255), displayName };
}

