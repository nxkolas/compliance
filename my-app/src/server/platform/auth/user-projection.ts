import type { User } from "@supabase/supabase-js";

export type AuthenticatedActor = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export type SafeUserIdentity = {
  userId: string;
  email: string;
  displayName: string | null;
};

export function projectAuthenticatedActor(user: User): AuthenticatedActor {
  const email = user.email?.trim().toLowerCase() || null;
  const candidate = user.user_metadata?.full_name;
  const displayName =
    typeof candidate === "string" && candidate.trim()
      ? candidate.trim().slice(0, 160)
      : null;
  return {
    id: user.id,
    email: email?.slice(0, 255) ?? null,
    displayName,
  };
}

export function projectAuthenticatedUser(user: User): SafeUserIdentity | null {
  const actor = projectAuthenticatedActor(user);
  return projectActorDirectoryIdentity(actor);
}

export function projectActorDirectoryIdentity(
  actor: AuthenticatedActor,
): SafeUserIdentity | null {
  if (!actor.email) return null;
  return {
    userId: actor.id,
    email: actor.email,
    displayName: actor.displayName,
  };
}

