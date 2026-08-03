import type { ReactNode } from "react";
import { requireAuth } from "@/lib/supabase/require-auth";
import { synchronizeAuthenticatedActor } from "@/src/server/users";

export default async function ToolLayout({ children }: { children: ReactNode }) {
  const actor = await requireAuth();
  await synchronizeAuthenticatedActor(actor);
  return children;
}
