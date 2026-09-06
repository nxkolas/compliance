import { AppShell } from "@/components/app-shell";
import { OrganizationInbox } from "@/components/organizations/organization-inbox";
import { PageHeader } from "@/components/page-header";
import { getDictionary, getLocale } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import { listMailboxInvitationsForUser } from "@/src/server/modules/organizations";
import { connection } from "next/server";

export default async function InboxPage() {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const invitations = await listMailboxInvitationsForUser(user);

  return (
    <AppShell dictionary={dictionary}>
      <div className="flex w-full flex-col gap-8">
        <PageHeader
          title={dictionary.inbox.title}
          subtitle={dictionary.inbox.description}
        />
        <OrganizationInbox
          initialInvitations={serializeForClient(invitations)}
          userEmail={user.email ?? null}
          labels={dictionary.inbox}
          locale={locale}
        />
      </div>
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
