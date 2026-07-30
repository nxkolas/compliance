"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDate as formatLocalizedDate } from "@/lib/i18n/format";
import { localizeUiError } from "@/lib/i18n/errors";
import type {
  OrganizationInvitationDto,
  OrganizationRole,
} from "@/src/server/organizations/types";
import { Loader2, MailSearch, Plus, Send, Trash2 } from "lucide-react";
import { FormEvent, type ReactNode, useState } from "react";
import { organizationsClient } from "@/src/client/organizations";
import { OrganizationAvatar } from "./organization-avatar";

type SerializedInvitation = SerializeDates<OrganizationInvitationDto>;

type OrganizationInvitePanelProps = {
  organizationId: string;
  initialInvitations: SerializedInvitation[];
  labels: Dictionary["invite"];
  locale: Locale;
  canManage: boolean;
  presentation?: "default" | "dialog";
  children?: ReactNode;
};

type InviteState = {
  email: string;
  role: Exclude<OrganizationRole, "owner">;
};

type RequestState = {
  message: string | null;
  tone: "default" | "success" | "error";
};

type SerializeDates<T> = {
  [K in keyof T]: T[K] extends null
    ? null
    : T[K] extends Date
      ? string
      : T[K] extends Date | null
        ? string | null
        : T[K] extends object
          ? SerializeDates<T[K]>
          : T[K];
};

const roleOptions: Array<InviteState["role"]> = ["member", "admin", "auditor"];

export function OrganizationInvitePanel({
  organizationId,
  initialInvitations,
  labels,
  locale,
  canManage,
  presentation = "default",
  children,
}: OrganizationInvitePanelProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteForm, setInviteForm] = useState<InviteState>({
    email: "",
    role: "member",
  });
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingInvitation(true);
    setNotice({ message: null, tone: "default" });

    try {
      const result = await organizationsClient.invite(organizationId, inviteForm);
      const invitation = result.data.invitation as SerializedInvitation;
      setInvitations((current) => [
        invitation,
        ...current.map((candidate) =>
          candidate.email === invitation.email && candidate.status === "pending"
            ? { ...candidate, status: "revoked" as const }
            : candidate,
        ),
      ]);
      setInviteForm((current) => ({
        email: "",
        role: current.role,
      }));
      setNotice({
        message: `${labels.successPrefix} ${invitation.email} ${labels.successSuffix}`,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: localizeUiError(error, {
          fallback: labels.createErrorFallback,
        }),
        tone: "error",
      });
    } finally {
      setIsCreatingInvitation(false);
    }
  }

  async function handleInvitationAction(
    invitation: SerializedInvitation,
    action: "resend" | "revoke",
  ) {
    setPendingAction(invitation.id);
    try {
      const result = action === "resend"
        ? await organizationsClient.resendInvitation(organizationId, invitation.id)
        : await organizationsClient.revokeInvitation(organizationId, invitation.id);
      setInvitations((current) => current.map((candidate) =>
        candidate.id === invitation.id
          ? result.data.invitation as SerializedInvitation
          : candidate,
      ));
      setNotice({
        message: action === "resend" ? labels.resent : labels.revoked,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: localizeUiError(error, { fallback: labels.actionError }),
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (presentation === "dialog") {
    const pendingInvitations = invitations.filter(
      (invitation) => invitation.status === "pending",
    );

    return (
      <div className="grid">
        {notice.message && (
          <div
            role="status"
            className={cn(
              "mb-3 rounded-lg border px-4 py-3 text-sm",
              notice.tone === "success" &&
                "border-success/30 bg-success/10 text-success-foreground",
              notice.tone === "error" &&
                "border-destructive/40 bg-destructive/10 text-destructive-muted-foreground",
            )}
          >
            {notice.message}
          </div>
        )}

        {canManage && (
          <form
            className="grid gap-3 pb-5 sm:grid-cols-[288px_minmax(0,1fr)_176px_112px] sm:items-center sm:gap-6"
            onSubmit={handleCreateInvitation}
          >
            <div className="relative">
              <Label htmlFor="dialog-invite-email" className="sr-only">
                {labels.email}
              </Label>
              <MailSearch
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground-subtle"
              />
              <Input
                id="dialog-invite-email"
                type="email"
                placeholder={labels.dialogEmailPlaceholder}
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="h-12 rounded-lg border-[1.5px] border-border-strong bg-surface/20 pr-3 pl-9 font-['Space_Grotesk'] text-base font-normal text-foreground shadow-none placeholder:text-foreground/60 focus-visible:border-primary focus-visible:ring-0 dark:bg-surface/20"
                required
              />
            </div>

            <span aria-hidden="true" className="hidden sm:block" />

            <div>
              <Label htmlFor="dialog-invite-role" className="sr-only">
                {labels.role}
              </Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: value as InviteState["role"],
                  }))
                }
              >
                <SelectTrigger
                  id="dialog-invite-role"
                  className="h-12 w-full rounded-lg border-[1.5px] border-border-strong bg-surface px-5 font-['Space_Grotesk'] text-base font-normal text-foreground shadow-none focus-visible:border-primary focus-visible:ring-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-44 rounded-2xl border-surface bg-surface p-0 font-['Space_Grotesk'] text-foreground shadow-popover">
                  {roleOptions.map((role) => (
                    <SelectItem
                      key={role}
                      value={role}
                      className="h-12 rounded-lg px-5 text-base font-normal focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent"
                    >
                      {labels.roles[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={isCreatingInvitation}
              className="h-12 w-full justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {isCreatingInvitation ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {labels.invite}
            </Button>
          </form>
        )}

        {children}

        {pendingInvitations.map((invitation) => (
          <article
            key={invitation.id}
            className="grid min-h-[90px] grid-cols-[minmax(0,1fr)_176px_32px] items-center gap-4 border-t border-border-strong/50 px-3"
            title={`${labels.expires} ${formatDate(
              invitation.expiresAt,
              locale,
              labels.withoutDeadline,
            )}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <OrganizationAvatar
                id={invitation.id}
                name={invitation.email}
                className="size-10 rounded-full text-sm"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium leading-5 text-foreground">
                    {invitation.email.split("@")[0]}
                  </p>
                  <span className="shrink-0 rounded-sm bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-success uppercase">
                    {labels.statuses.pending}
                  </span>
                </div>
                <p className="truncate pt-0.5 text-xs font-normal leading-4 text-foreground-subtle">
                  {invitation.email}
                </p>
              </div>
            </div>

            <div className="flex h-12 w-44 items-center rounded-lg border-[1.5px] border-border-strong bg-surface px-5 text-base text-foreground">
              {labels.roles[invitation.role]}
            </div>

            <div className="flex size-8 items-center justify-center">
              {pendingAction === invitation.id ? (
                <Loader2 className="size-4 animate-spin text-foreground-subtle" />
              ) : canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${labels.revoke}: ${invitation.email}`}
                  title={labels.revoke}
                  onClick={() => handleInvitationAction(invitation, "revoke")}
                  className="size-8 rounded-[10px] text-foreground-subtle hover:bg-destructive/20 hover:text-destructive-muted-foreground focus-visible:ring-destructive/30 dark:hover:bg-destructive/20 dark:hover:text-destructive-muted-foreground"
                >
                  <Trash2 className="size-5" />
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {notice.message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            notice.tone === "success" &&
              "border-success/30 bg-success/10 text-success-foreground",
            notice.tone === "error" &&
              "border-destructive/40 bg-destructive/10 text-destructive-muted-foreground",
          )}
        >
          {notice.message}
        </div>
      )}

      <Card className={cn("rounded-lg shadow-sm", !canManage && "hidden")}>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>
            {labels.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleCreateInvitation}>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">{labels.email}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder={labels.emailPlaceholder}
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">{labels.role}</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) =>
                    setInviteForm((current) => ({
                      ...current,
                      role: value as InviteState["role"],
                    }))
                  }
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {labels.roles[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isCreatingInvitation}
                >
                  {isCreatingInvitation ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Send />
                  )}
                  {labels.invite}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>{labels.historyTitle}</CardTitle>
          <CardDescription>
            {labels.historyDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {invitations.filter((invitation) => invitation.status === "pending").length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {labels.empty}
            </div>
          ) : (
            invitations.filter((invitation) => invitation.status === "pending").map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {labels.role}: {labels.roles[invitation.role]} {" · "}
                    {labels.expires}{" "}
                    {formatDate(
                      invitation.expiresAt,
                      locale,
                      labels.withoutDeadline,
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
                    {labels.statuses[invitation.status]}
                  </span>
                  {canManage && (
                    <>
                      <Button aria-label={`${labels.resend}: ${invitation.email}`} variant="outline" size="sm" disabled={pendingAction === invitation.id} onClick={() => handleInvitationAction(invitation, "resend")}>{labels.resend}</Button>
                      <Button aria-label={`${labels.revoke}: ${invitation.email}`} variant="ghost" size="sm" disabled={pendingAction === invitation.id} onClick={() => handleInvitationAction(invitation, "revoke")}>{labels.revoke}</Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {invitations.some((invitation) => invitation.status !== "pending") && (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer font-medium">{labels.completedHistory}</summary>
          <div className="mt-3 grid gap-2">
            {invitations.filter((invitation) => invitation.status !== "pending").map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{invitation.email}</span>
                <span className="text-muted-foreground">{labels.statuses[invitation.status]}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  if (!value) {
    return fallback;
  }

  return formatLocalizedDate(value, locale, { dateStyle: "medium" });
}
