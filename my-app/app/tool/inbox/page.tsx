import { AppShell } from "@/components/app-shell";
import { OrganizationInbox } from "@/components/organizations/organization-inbox";
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
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">{dictionary.inbox.title}</h1>
            <p className="max-w-2xl text-[#002BFF] dark:text-muted-foreground">
              {dictionary.inbox.description}
            </p>
          </div>
        </section>
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
