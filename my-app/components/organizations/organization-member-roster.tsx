"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, UserMinus } from "lucide-react";
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

  return (
    <section className={presentation === "dialog" ? "grid gap-3" : "grid gap-4 rounded-lg border bg-card p-5"}>
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
                <div className="flex items-center gap-2">
                  <Select
                    value={member.role}
                    disabled={!controls.canManage || busy}
                    onValueChange={(value) => void updateRole(member, value as OrganizationRole)}
                  >
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
