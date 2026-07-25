"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, RotateCcw, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { organizationsClient } from "@/src/client/organizations";
import type { Dictionary } from "@/lib/i18n";
import type {
  OrganizationMemberDto,
  OrganizationRole,
} from "@/src/server/organizations/types";
import { localizeUiError } from "@/lib/i18n/errors";

type SerializedMember = Omit<
  OrganizationMemberDto,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export function OrganizationMemberRoster({
  organizationId,
  initialMembers,
  controls,
  labels,
}: {
  organizationId: string;
  initialMembers: SerializedMember[];
  controls: {
    actorUserId: string;
    canManage: boolean;
    canManageOwners: boolean;
  };
  labels: Dictionary["teamManagement"];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeMembers = members.filter((member) => member.status === "active");
  const pastMembers = members.filter((member) => member.status !== "active");

  async function runMemberMutation(
    member: SerializedMember,
    mutation: () => ReturnType<typeof organizationsClient.updateMember>,
  ) {
    setPending(member.userId);
    setNotice(null);
    try {
      const result = await mutation();
      setMembers((current) =>
        current.map((candidate) =>
          candidate.userId === member.userId
            ? { ...candidate, ...result.data.member }
            : candidate,
        ),
      );
      setNotice(labels.updated);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.updateError }));
    } finally {
      setPending(null);
    }
  }

  async function updateRole(
    member: SerializedMember,
    role: OrganizationRole,
  ) {
    await runMemberMutation(member, () =>
      organizationsClient.updateMember(
        organizationId,
        member.userId,
        { role },
        member.version,
      ),
    );
  }

  async function remove(member: SerializedMember) {
    if (!window.confirm(labels.removeConfirm)) return;
    await runMemberMutation(member, () =>
      organizationsClient.removeMember(
        organizationId,
        member.userId,
        member.version,
      ),
    );
  }

  async function restore(member: SerializedMember) {
    if (!window.confirm(labels.restoreConfirm)) return;
    await runMemberMutation(member, () =>
      organizationsClient.restoreMember(
        organizationId,
        member.userId,
        member.version,
      ),
    );
  }

  async function leave(member: SerializedMember) {
    if (!window.confirm(labels.leaveConfirm)) return;
    setPending(member.userId);
    setNotice(null);
    try {
      await organizationsClient.leave(organizationId, member.version);
      router.push("/tool/organizations");
      router.refresh();
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.updateError }));
      setPending(null);
    }
  }

  return (
    <section className="grid gap-6">
      <div>
        <h2 className="text-xl font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">
          {controls.canManage
            ? labels.manageDescription
            : labels.readOnlyDescription}
        </p>
      </div>
      {notice && (
        <div role="status" className="rounded-md border px-4 py-3 text-sm">
          {notice}
        </div>
      )}
      <MemberSection title={labels.activeTitle} empty={labels.noActiveMembers}>
        {activeMembers.map((member) => {
          const isSelf = member.userId === controls.actorUserId;
          const canManageMember =
            controls.canManage &&
            (member.role !== "owner" || controls.canManageOwners);
          return (
            <MemberCard key={member.id} member={member} labels={labels}>
              {canManageMember ? (
                <Select
                  value={member.role}
                  onValueChange={(role) =>
                    updateRole(member, role as OrganizationRole)
                  }
                  disabled={pending === member.userId}
                >
                  <SelectTrigger aria-label={labels.role}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["admin", "member", "auditor"] as OrganizationRole[]).map(
                      (role) => (
                        <SelectItem key={role} value={role}>
                          {labels.roles[role]}
                        </SelectItem>
                      ),
                    )}
                    {controls.canManageOwners && (
                      <SelectItem value="owner">
                        {labels.roles.owner}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">{labels.roles[member.role]}</span>
              )}
              <div className="flex justify-end">
                {pending === member.userId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isSelf ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => leave(member)}
                  >
                    <LogOut />
                    {labels.leave}
                  </Button>
                ) : canManageMember ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(member)}
                  >
                    <UserMinus />
                    {labels.remove}
                  </Button>
                ) : null}
              </div>
            </MemberCard>
          );
        })}
      </MemberSection>
      <MemberSection
        title={labels.pastTitle}
        description={labels.pastDescription}
        empty={labels.noPastMembers}
      >
        {pastMembers.map((member) => {
          const canRestore =
            member.status === "removed" &&
            controls.canManage &&
            (member.role !== "owner" || controls.canManageOwners);
          return (
            <MemberCard key={member.id} member={member} labels={labels}>
              <div className="grid gap-1 text-sm">
                <span>{labels.roles[member.role]}</span>
                <span className="text-muted-foreground">
                  {labels.statuses[member.status]}
                </span>
              </div>
              <div className="flex justify-end">
                {pending === member.userId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : canRestore ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restore(member)}
                  >
                    <RotateCcw />
                    {labels.restore}
                  </Button>
                ) : null}
              </div>
            </MemberCard>
          );
        })}
      </MemberSection>
    </section>
  );
}

function MemberSection({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description?: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children.length > 0 ? (
        <div className="grid gap-3">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}

function MemberCard({
  member,
  labels,
  children,
}: {
  member: SerializedMember;
  labels: Dictionary["teamManagement"];
  children: React.ReactNode;
}) {
  return (
    <article className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {member.identityResolved
            ? member.displayName || member.email
            : labels.unresolvedMember}
        </p>
        {member.identityResolved && member.displayName && (
          <p className="truncate text-sm text-muted-foreground">
            {member.email}
          </p>
        )}
        {!member.identityResolved && (
          <p className="text-xs text-amber-600">
            {labels.unresolvedIdentity}
          </p>
        )}
      </div>
      {children}
    </article>
  );
}
