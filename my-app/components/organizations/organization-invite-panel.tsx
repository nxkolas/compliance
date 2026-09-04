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
import type { OrganizationInvitationDto } from "@/src/server/modules/organizations/types";
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

  if (presentation === "dialog") {
    return (
      <div className="grid">
        {children}
        {notice ? <div role="status" className="my-3 rounded-lg border border-border-strong bg-foreground/5 px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}
        {canManage ? (
          <form className="grid gap-3 border-t border-border-strong/50 px-3 py-5 sm:grid-cols-[minmax(0,1fr)_176px_112px] sm:items-end sm:gap-4" onSubmit={invite}>
            <div className="grid gap-2">
              <Label htmlFor="dialog-invite-email" className="text-sm font-medium">{labels.email}</Label>
              <Input id="dialog-invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 rounded-lg border-[1.5px] border-border-strong bg-surface px-5 text-base shadow-none" />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">{labels.role}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                <SelectTrigger className="h-12 w-44 rounded-lg border-[1.5px] border-border-strong bg-surface px-5 text-base shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent className="w-44 rounded-2xl border-surface bg-surface p-0 shadow-popover">
                  <SelectItem value="contributor" className="h-12 rounded-lg px-5 text-base">{labels.roles.contributor}</SelectItem>
                  <SelectItem value="viewer" className="h-12 rounded-lg px-5 text-base">{labels.roles.viewer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="h-12 rounded-lg" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />}{labels.invite}</Button>
          </form>
        ) : null}
        <div className="grid border-t border-border-strong/50">
          {!invitations.length ? (
            <p className="px-3 py-6 text-sm text-foreground-subtle">{labels.empty}</p>
          ) : invitations.map((invitation) => (
            <article key={invitation.id} className="flex min-h-[78px] items-center justify-between gap-4 border-b border-border-strong/50 px-3 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{invitation.email}</p>
                <p className="mt-1 truncate text-sm text-foreground-subtle">{labels.roles[invitation.role]} · {labels.expires} {formatDate(invitation.expiresAt, locale, { dateStyle: "medium" })}</p>
              </div>
              {canManage ? <Button variant="ghost" size="icon-sm" aria-label={labels.revoke} onClick={() => void revoke(invitation.id)} className="rounded-[10px] text-foreground-subtle hover:bg-destructive/20 hover:text-destructive-muted-foreground"><Trash2 className="size-5" /></Button> : null}
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5">
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
          <div key={invitation.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{invitation.email}</p>
              <p className="truncate text-sm text-muted-foreground">
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
