import { connection } from "next/server";
import { notFound } from "next/navigation";
import { OrganizationInvitePanel } from "@/components/organizations/organization-invite-panel";
import { OrganizationMemberRoster } from "@/components/organizations/organization-member-roster";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { resolveOrganizationCapabilities } from "@/src/server/auth/capability-service";
import {
  getOrganizationForUser,
  listOrganizationInvitations,
  listOrganizationMembersPage,
} from "@/src/server/organizations/service";
import { synchronizeAuthenticatedActor } from "@/src/server/users";

type Props = { params: Promise<{ organizationId: string }> };

export default async function OrganizationTeamPage({ params }: Props) {
  await connection();
  const user = await requireAuth();
  await synchronizeAuthenticatedActor(user);
  const { organizationId } = await params;
  const [dictionary, locale, organization, authorization, memberResult] = await Promise.all([
    getDictionary(),
    getLocale(),
    getOrganizationForUser(user.id, organizationId),
    resolveOrganizationCapabilities(user.id, organizationId),
    listOrganizationMembersPage({ userId: user.id, organizationId, limit: 100 }),
  ]);
  if (!organization) notFound();
  const canManage = authorization.capabilities.has("members:manage");
  const invitations = canManage
    ? await listOrganizationInvitations(user.id, organizationId)
    : [];

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold">{organization.name} · {dictionary.organizations.teamTitle}</h1>
        <p className="max-w-2xl text-muted-foreground">{dictionary.organizations.teamDescription}</p>
      </header>
      <OrganizationMemberRoster
        organizationId={organizationId}
        initialMembers={serialize(memberResult.members)}
        controls={{
          actorUserId: user.id,
          canManage,
          canManageOwners:
            authorization.membership?.role === "owner",
        }}
        labels={dictionary.teamManagement}
      />
      <OrganizationInvitePanel
        organizationId={organizationId}
        initialInvitations={serialize(invitations)}
        labels={dictionary.invite}
        locale={locale}
        canManage={canManage}
      />
    </div>
  );
}

function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value)) as Serialized<T>;
}
type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
