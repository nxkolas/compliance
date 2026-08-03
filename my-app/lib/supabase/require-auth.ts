import { cache } from "react";
import { redirect } from "next/navigation";
import { resolveAuthenticatedActor } from "@/src/server/auth/authenticated-actor";

const resolveActorForRequest = cache(resolveAuthenticatedActor);

/**
 * Server-component guard that returns the safe actor or redirects to login.
 */
export async function requireAuth() {
  const actor = await resolveActorForRequest();
  if (!actor) {
    redirect("/auth/login");
  }
  return actor;
}
