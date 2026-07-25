"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
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
import type { OrganizationMemberDto, OrganizationRole } from "@/src/server/organizations/types";
import { localizeUiError } from "@/lib/i18n/errors";

type SerializedMember = Omit<OrganizationMemberDto, "createdAt" | "updatedAt"> & {
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
  controls: { actorUserId: string; canManage: boolean; canManageOwners: boolean };
  labels: Dictionary["teamManagement"];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function update(member: SerializedMember, role: OrganizationRole, status: "active" | "suspended") {
    setPending(member.userId);
    setNotice(null);
    try {
      const result = await organizationsClient.updateMember(
        organizationId,
        member.userId,
        { role, status },
        member.version,
      );
      setMembers((current) => current.map((candidate) => candidate.userId === member.userId
        ? { ...candidate, ...result.data.member }
        : candidate));
      setNotice(labels.updated);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.updateError }));
    } finally {
      setPending(null);
    }
  }

  async function leave(member: SerializedMember) {
    if (!window.confirm(labels.leaveConfirm)) return;
    setPending(member.userId);
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
    <section className="grid gap-3">
      <div>
        <h2 className="text-xl font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">{controls.canManage ? labels.manageDescription : labels.readOnlyDescription}</p>
      </div>
      {notice && <div role="status" className="rounded-md border px-4 py-3 text-sm">{notice}</div>}
      <div className="grid gap-3">
        {members.map((member) => {
          const isSelf = member.userId === controls.actorUserId;
          const canMutate = controls.canManage && (member.role !== "owner" || controls.canManageOwners);
          return (
            <article key={member.id} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_160px_150px_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {member.identityResolved
                    ? member.displayName || member.email
                    : labels.unresolvedMember}
                </p>
                {member.identityResolved && member.displayName && <p className="truncate text-sm text-muted-foreground">{member.email}</p>}
                {!member.identityResolved && <p className="text-xs text-amber-600">{labels.unresolvedIdentity}</p>}
              </div>
              {canMutate ? (
                <Select value={member.role} onValueChange={(role) => update(member, role as OrganizationRole, member.status)} disabled={pending === member.userId}>
                  <SelectTrigger aria-label={labels.role}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["admin", "member", "auditor"] as OrganizationRole[]).map((role) => <SelectItem key={role} value={role}>{labels.roles[role]}</SelectItem>)}
                    {controls.canManageOwners && member.status === "active" && <SelectItem value="owner">{labels.roles.owner}</SelectItem>}
                  </SelectContent>
                </Select>
              ) : <span className="text-sm">{labels.roles[member.role]}</span>}
              {canMutate ? (
                <Select value={member.status} onValueChange={(status) => update(member, member.role, status as "active" | "suspended")} disabled={pending === member.userId}>
                  <SelectTrigger aria-label={labels.status}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{labels.statuses.active}</SelectItem>
                    <SelectItem value="suspended">{labels.statuses.suspended}</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="text-sm text-muted-foreground">{labels.statuses[member.status]}</span>}
              <div className="flex justify-end">
                {pending === member.userId ? <Loader2 className="size-4 animate-spin" /> : isSelf ? (
                  <Button variant="outline" size="sm" onClick={() => leave(member)}><LogOut />{labels.leave}</Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
