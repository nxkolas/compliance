import { AppNavigation } from "@/components/app-navigation";
import { OrganizationWorkspace } from "@/components/organizations/organization-workspace";
import { requireAuth } from "@/lib/supabase/require-auth";
import {
  listMailboxInvitationsForUser,
  listOrganizationsForUser,
} from "@/src/server/organizations/service";
import { connection } from "next/server";

export default async function OrganizationsPage() {
  await connection();
  const user = await requireAuth();
  const [organizations, invitations] = await Promise.all([
    listOrganizationsForUser(user.id),
    listMailboxInvitationsForUser(user),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-8">
      <AppNavigation />
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Organizations</h1>
        <p className="max-w-2xl text-muted-foreground">
          Create compliance workspaces, invite teammates, and accept pending
          organization invitations.
        </p>
      </section>
      <OrganizationWorkspace
        initialOrganizations={serializeForClient(organizations)}
        initialInvitations={serializeForClient(invitations)}
        userEmail={user.email ?? null}
      />
    </main>
  );
}

function serializeForClient<T>(value: T): JSONValue<T> {
  return JSON.parse(JSON.stringify(value)) as JSONValue<T>;
}

type JSONValue<T> = T extends null
  ? null
  : T extends Date
  ? string
  : T extends Date | null
    ? string | null
    : T extends Array<infer U>
      ? Array<JSONValue<U>>
      : T extends object
        ? { [K in keyof T]: JSONValue<T[K]> }
        : T;
