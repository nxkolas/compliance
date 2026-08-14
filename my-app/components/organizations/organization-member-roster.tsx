"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, Trash2, UserMinus } from "lucide-react";
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

type SerializedMember = Omit<OrganizationMemberDto, "createdAt"> & {
  createdAt: string;
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

  async function updateRole(member: SerializedMember, role: OrganizationRole) {
    setPending(member.userId);
    setNotice(null);
    try {
      const result = await organizationsClient.updateMember(
        organizationId,
        member.userId,
        { role },
      );
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

  async function remove(member: SerializedMember) {
    if (!window.confirm(labels.removeConfirm)) return;
    setPending(member.userId);
    try {
      await organizationsClient.removeMember(organizationId, member.userId);
      setMembers((current) =>
        current.filter((candidate) => candidate.userId !== member.userId),
      );
      setNotice(labels.updated);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.updateError }));
    } finally {
      setPending(null);
    }
  }

  async function leave() {
    if (!window.confirm(labels.leaveConfirm)) return;
    setPending(controls.actorUserId);
    try {
      await organizationsClient.leave(organizationId);
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
        {notice ? (
          <div role="status" className="mb-3 rounded-lg border border-border-strong bg-foreground/5 px-4 py-3 text-sm text-muted-foreground">
            {notice}
          </div>
        ) : null}
        {!members.length ? (
          <p className="border-t border-border-strong/50 px-3 py-6 text-sm text-foreground-subtle">
            {labels.noActiveMembers}
          </p>
        ) : members.map((member) => {
          const isSelf = member.userId === controls.actorUserId;
          const busy = pending === member.userId;
          const canManageMember = controls.canManage && (member.role !== "owner" || controls.canManageOwners);
          return (
            <article key={member.userId} className="grid min-h-[90px] grid-cols-[minmax(0,1fr)_32px] items-center gap-3 border-t border-border-strong/50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_176px_32px] sm:gap-4 sm:py-0">
              <div className="flex min-w-0 items-center gap-3">
                <OrganizationAvatar id={member.userId} name={member.displayName || member.email || labels.unresolvedMember} className="size-10" />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{member.displayName || member.email || labels.unresolvedMember}</p>
                  <p className="truncate text-sm text-foreground-subtle">{member.email}</p>
                </div>
              </div>
              <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                {canManageMember ? (
                  <Select value={member.role} disabled={busy} onValueChange={(value) => void updateRole(member, value as OrganizationRole)}>
                    <SelectTrigger aria-label={labels.role} className="h-12 w-full rounded-lg border-[1.5px] border-border-strong bg-surface px-5 text-base shadow-none sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent className="w-44 rounded-2xl border-surface bg-surface p-0 shadow-popover">
                      {(["owner", "contributor", "viewer"] as const).map((role) => <SelectItem key={role} value={role} className="h-12 rounded-lg px-5 text-base">{labels.roles[role]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-12 w-full items-center rounded-lg border-[1.5px] border-border-strong bg-surface px-5 text-base sm:w-44">{labels.roles[member.role]}</div>
                )}
              </div>
              <div className="order-2 flex size-8 items-center justify-center sm:order-none">
                {busy ? <Loader2 className="size-4 animate-spin text-foreground-subtle" /> : isSelf ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.leave} title={labels.leave} onClick={() => void leave()} className="size-8 rounded-[10px] text-foreground-subtle"><LogOut className="size-4" /></Button>
                ) : canManageMember ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.remove} title={labels.remove} onClick={() => void remove(member)} className="size-8 rounded-[10px] text-foreground-subtle hover:bg-destructive/20 hover:text-destructive-muted-foreground"><Trash2 className="size-5" /></Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">
          {controls.canManage ? labels.manageDescription : labels.readOnlyDescription}
        </p>
      </div>
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      <div className="grid gap-2">
        {members.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {labels.noActiveMembers}
          </p>
        ) : (
          members.map((member) => {
            const isSelf = member.userId === controls.actorUserId;
            const busy = pending === member.userId;
            return (
              <div key={member.userId} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <OrganizationAvatar id={member.userId} name={member.displayName || member.email || labels.unresolvedMember} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.displayName || member.email || labels.unresolvedMember}</p>
                    <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={member.role}
                    disabled={!controls.canManage || busy}
                    onValueChange={(value) => void updateRole(member, value as OrganizationRole)}
                  >
                    <SelectTrigger className="min-w-32 flex-1 sm:w-40 sm:flex-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["owner", "contributor", "viewer"] as const).map((role) => (
                        <SelectItem key={role} value={role}>{labels.roles[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSelf ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void leave()}>
                      {busy ? <Loader2 className="animate-spin" /> : <LogOut />}
                      {labels.leave}
                    </Button>
                  ) : controls.canManage ? (
                    <Button variant="outline" size="icon" aria-label={labels.remove} disabled={busy} onClick={() => void remove(member)}>
                      {busy ? <Loader2 className="animate-spin" /> : <UserMinus />}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
