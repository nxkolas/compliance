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
import { Loader2, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { organizationsClient } from "@/src/client/organizations";

type SerializedInvitation = SerializeDates<OrganizationInvitationDto>;

type OrganizationInvitePanelProps = {
  organizationId: string;
  initialInvitations: SerializedInvitation[];
  labels: Dictionary["invite"];
  locale: Locale;
  canManage: boolean;
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

  return (
    <div className="grid gap-4">
      {notice.message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            notice.tone === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-900",
            notice.tone === "error" &&
              "border-red-200 bg-red-50 text-red-900",
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
