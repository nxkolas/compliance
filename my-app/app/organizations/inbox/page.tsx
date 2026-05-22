import { AppShell } from "@/components/app-shell";
import { OrganizationInbox } from "@/components/organizations/organization-inbox";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listMailboxInvitationsForUser } from "@/src/server/organizations/service";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

export default function OrganizationInboxPage() {
  return (
    <Suspense fallback={<OrganizationInboxPageFallback />}>
      <OrganizationInboxPageContent />
    </Suspense>
  );
}

async function OrganizationInboxPageContent() {
  await connection();
  const user = await requireAuth();
  const invitations = await listMailboxInvitationsForUser(user);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/organizations">
            <ArrowLeft />
            Organizations
          </Link>
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Invitation inbox</h1>
          <p className="max-w-2xl text-muted-foreground">
            Accept pending organization invitations for your account.
          </p>
        </div>
      </section>
      <OrganizationInbox
        initialInvitations={serializeForClient(invitations)}
        userEmail={user.email ?? null}
      />
      </div>
    </AppShell>
  );
}

function OrganizationInboxPageFallback() {
  return (
    <AppShell>
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Invitation inbox</h1>
        <p className="max-w-2xl text-muted-foreground">
          Loading invitations...
        </p>
      </section>
    </AppShell>
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
