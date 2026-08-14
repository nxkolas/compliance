"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDate as formatLocalizedDate } from "@/lib/i18n/format";
import { localizeUiError } from "@/lib/i18n/errors";
import type { OrganizationMailboxInvitationDto } from "@/src/server/organizations/types";
import { Check, Inbox, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { organizationsClient } from "@/src/client/organizations";

type SerializedMailboxInvitation =
  SerializeDates<OrganizationMailboxInvitationDto>;

type OrganizationInboxProps = {
  initialInvitations: SerializedMailboxInvitation[];
  userEmail: string | null;
  labels: Dictionary["inbox"];
  locale: Locale;
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

export function OrganizationInbox({
  initialInvitations,
  userEmail,
  labels,
  locale,
}: OrganizationInboxProps) {
  const router = useRouter();
  const [invitations, setInvitations] = useState(initialInvitations);
  const [loadingInvitationId, setLoadingInvitationId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  async function handleAcceptInvitation(invitationId: string) {
    setLoadingInvitationId(invitationId);
    setNotice({ message: null, tone: "default" });

    try {
      await organizationsClient.acceptInvitation(invitationId);

      setInvitations((current) =>
        current.filter((invitation) => invitation.id !== invitationId),
      );
      setNotice({
        message: labels.accepted,
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message: localizeUiError(error, {
          fallback: labels.acceptErrorFallback,
        }),
        tone: "error",
      });
    } finally {
      setLoadingInvitationId(null);
    }
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

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>{labels.cardTitle}</CardTitle>
                <CardDescription>
                  {labels.pendingFor} {userEmail ?? labels.yourAccount}.
                </CardDescription>
              </div>
            </div>
            <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
              {invitations.length} {labels.pending}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {invitations.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {labels.empty}
            </div>
          ) : (
            invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {invitation.organization.name}
                  </p>
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
                <Button
                  size="sm"
                  onClick={() => handleAcceptInvitation(invitation.id)}
                  disabled={loadingInvitationId === invitation.id}
                  className="w-full sm:w-auto"
                >
                  {loadingInvitationId === invitation.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  {labels.accept}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  if (!value) {
    return fallback;
  }

  return formatLocalizedDate(value, locale, { dateStyle: "medium" });
}
