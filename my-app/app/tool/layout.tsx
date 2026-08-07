import type { ReactNode } from "react";
import { requireAuth } from "@/lib/supabase/require-auth";
import { synchronizeAuthenticatedActor } from "@/src/server/users";
import { ClientInferenceRelayHost } from "@/components/organizations/client-inference-relay-host";

export default async function ToolLayout({ children }: { children: ReactNode }) {
  const actor = await requireAuth();
  await synchronizeAuthenticatedActor(actor);
  return <ClientInferenceRelayHost>{children}</ClientInferenceRelayHost>;
}
