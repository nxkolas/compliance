"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, RotateCcw, Trash2, UserMinus } from "lucide-react";
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
import { OrganizationAvatar } from "./organization-avatar";

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
  presentation = "default",
}: {
  organizationId: string;
  initialMembers: SerializedMember[];
  controls: {
    actorUserId: string;
    canManage: boolean;
    canManageOwners: boolean;
  };
  labels: Dictionary["teamManagement"];
  presentation?: "default" | "dialog";
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

  if (presentation === "dialog") {
    return (
      <section className="grid">
        {notice && (
          <div
            role="status"
            className="mb-3 rounded-lg border border-zinc-700 bg-white/5 px-4 py-3 text-sm text-zinc-200"
          >
            {notice}
          </div>
        )}

        {activeMembers.length === 0 ? (
          <p className="border-t border-zinc-700/50 px-3 py-6 text-sm text-gray-500">
            {labels.noActiveMembers}
          </p>
        ) : (
          activeMembers.map((member) => {
            const isSelf = member.userId === controls.actorUserId;
            const canManageMember =
              controls.canManage &&
              (member.role !== "owner" || controls.canManageOwners);

            return (
              <article
                key={member.id}
                className="grid min-h-[90px] grid-cols-[minmax(0,1fr)_176px_32px] items-center gap-4 border-t border-zinc-700/50 px-3"
              >
                <DialogMemberIdentity member={member} labels={labels} />

                {canManageMember ? (
                  <MemberRoleSelect
                    member={member}
                    labels={labels}
                    canManageOwners={controls.canManageOwners}
                    disabled={pending === member.userId}
                    onChange={(role) => updateRole(member, role)}
                  />
                ) : (
                  <div className="flex h-12 w-44 items-center rounded-lg border-[1.5px] border-zinc-700 bg-[#292C34] px-5 text-base text-white">
                    {labels.roles[member.role]}
                  </div>
                )}

                <div className="flex size-8 items-center justify-center">
                  {pending === member.userId ? (
                    <Loader2 className="size-4 animate-spin text-zinc-400" />
                  ) : isSelf ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={labels.leave}
                      title={labels.leave}
                      onClick={() => leave(member)}
                      className="size-8 rounded-[10px] text-zinc-400 hover:bg-red-900/20 hover:text-red-400 focus-visible:ring-red-400/30 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-5" />
                    </Button>
                  ) : canManageMember ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={labels.remove}
                      title={labels.remove}
                      onClick={() => remove(member)}
                      className="size-8 rounded-[10px] text-zinc-400 hover:bg-red-900/20 hover:text-red-400 focus-visible:ring-red-400/30 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-5" />
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}

        {pastMembers.map((member) => {
          const canRestore =
            member.status === "removed" &&
            controls.canManage &&
            (member.role !== "owner" || controls.canManageOwners);

          return (
            <article
              key={member.id}
              className="grid min-h-[90px] grid-cols-[minmax(0,1fr)_176px_32px] items-center gap-4 border-t border-zinc-700/50 px-3 opacity-70"
            >
              <DialogMemberIdentity
                member={member}
                labels={labels}
                status={labels.statuses[member.status]}
              />
              <div className="flex h-12 w-44 items-center rounded-lg border-[1.5px] border-zinc-700 bg-[#292C34] px-5 text-base text-white">
                {labels.roles[member.role]}
              </div>
              <div className="flex size-8 items-center justify-center">
                {pending === member.userId ? (
                  <Loader2 className="size-4 animate-spin text-zinc-400" />
                ) : canRestore ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.restore}
                    title={labels.restore}
                    onClick={() => restore(member)}
                    className="size-8 rounded-[10px] text-zinc-400 hover:bg-white/5 hover:text-white"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    );
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

function MemberRoleSelect({
  member,
  labels,
  canManageOwners,
  disabled,
  onChange,
}: {
  member: SerializedMember;
  labels: Dictionary["teamManagement"];
  canManageOwners: boolean;
  disabled: boolean;
  onChange: (role: OrganizationRole) => void;
}) {
  const roles: OrganizationRole[] = ["member", "admin", "auditor"];
  if (canManageOwners) roles.push("owner");

  return (
    <Select
      value={member.role}
      onValueChange={(role) => onChange(role as OrganizationRole)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={labels.role}
        className="h-12 w-44 rounded-lg border-[1.5px] border-zinc-700 bg-[#292C34] px-5 font-['Space_Grotesk'] text-base font-normal text-white shadow-none focus-visible:border-[#002BFF] focus-visible:ring-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-44 rounded-2xl border-[#292C34] bg-[#292C34] p-0 font-['Space_Grotesk'] text-white shadow-[0px_8px_32px_0px_rgba(0,0,0,0.50)]">
        {roles.map((role) => (
          <SelectItem
            key={role}
            value={role}
            className="h-12 rounded-lg px-5 text-base font-normal focus:bg-[#18275D] focus:text-white data-[state=checked]:bg-[#18275D]"
          >
            {labels.roles[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DialogMemberIdentity({
  member,
  labels,
  status,
}: {
  member: SerializedMember;
  labels: Dictionary["teamManagement"];
  status?: string;
}) {
  const name = member.identityResolved
    ? member.displayName || member.email
    : labels.unresolvedMember;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <OrganizationAvatar
        id={member.userId}
        name={name}
        className="size-10 rounded-full text-sm"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium leading-5 text-slate-200">
            {name}
          </p>
          {status ? (
            <span className="shrink-0 rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-4 text-gray-400">
              {status}
            </span>
          ) : null}
        </div>
        <p className="truncate pt-0.5 text-xs font-normal leading-4 text-gray-500">
          {member.email}
        </p>
      </div>
    </div>
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
