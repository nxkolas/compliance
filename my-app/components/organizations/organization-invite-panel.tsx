"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { localizeUiError } from "@/lib/i18n/errors";
import type { OrganizationInvitationDto } from "@/src/server/organizations/types";
import { organizationsClient } from "@/src/client/organizations";

type SerializedInvitation = Omit<
  OrganizationInvitationDto,
  "expiresAt" | "createdAt"
> & { expiresAt: string; createdAt: string };

export function OrganizationInvitePanel({
  organizationId,
  initialInvitations,
  labels,
  locale,
  canManage,
  presentation = "default",
  children,
}: {
  organizationId: string;
  initialInvitations: SerializedInvitation[];
  labels: Dictionary["invite"];
  locale: Locale;
  canManage: boolean;
  presentation?: "default" | "dialog";
  children?: ReactNode;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"contributor" | "viewer">("contributor");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const result = await organizationsClient.invite(organizationId, { email, role });
      setInvitations((current) => [
        result.data.invitation as SerializedInvitation,
        ...current.filter((item) => item.email !== result.data.invitation.email),
      ]);
      setEmail("");
      setNotice(`${labels.successPrefix} ${result.data.invitation.email} ${labels.successSuffix}`);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.createErrorFallback }));
    } finally {
      setPending(false);
    }
  }

  async function revoke(invitationId: string) {
    try {
      await organizationsClient.revokeInvitation(organizationId, invitationId);
      setInvitations((current) => current.filter((item) => item.id !== invitationId));
      setNotice(labels.revoked);
    } catch (error) {
      setNotice(localizeUiError(error, { fallback: labels.actionError }));
    }
  }

  return (
    <section className={presentation === "dialog" ? "grid gap-4" : "grid gap-4 rounded-lg border bg-card p-5"}>
      {children}
      <div>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="text-sm text-muted-foreground">{labels.description}</p>
      </div>
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      {canManage ? (
        <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" onSubmit={invite}>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">{labels.email}</Label>
            <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label>{labels.role}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contributor">{labels.roles.contributor}</SelectItem>
                <SelectItem value="viewer">{labels.roles.viewer}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />}{labels.invite}</Button>
        </form>
      ) : null}
      <div className="grid gap-2">
        {invitations.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{labels.empty}</p>
        ) : invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="font-medium">{invitation.email}</p>
              <p className="text-sm text-muted-foreground">
                {labels.roles[invitation.role]} · {labels.expires} {formatDate(invitation.expiresAt, locale, { dateStyle: "medium" })}
              </p>
            </div>
            {canManage ? <Button variant="ghost" size="icon" aria-label={labels.revoke} onClick={() => void revoke(invitation.id)}><Trash2 /></Button> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
