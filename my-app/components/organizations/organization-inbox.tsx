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
import type { OrganizationMailboxInvitationDto } from "@/src/server/organizations/types";
import { Check, Inbox, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SerializedMailboxInvitation =
  SerializeDates<OrganizationMailboxInvitationDto>;

type OrganizationInboxProps = {
  initialInvitations: SerializedMailboxInvitation[];
  userEmail: string | null;
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
      const response = await fetch(
        `/api/organization-invitations/${invitationId}/accept`,
        {
          method: "POST",
        },
      );
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Invitation could not be accepted");
      }

      setInvitations((current) =>
        current.filter((invitation) => invitation.id !== invitationId),
      );
      setNotice({
        message: "Invitation accepted.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Invitation acceptance failed",
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
              "border-emerald-200 bg-emerald-50 text-emerald-900",
            notice.tone === "error" &&
              "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {notice.message}
        </div>
      )}

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Invitation inbox</CardTitle>
                <CardDescription>
                  Pending invitations for {userEmail ?? "your account"}.
                </CardDescription>
              </div>
            </div>
            <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
              {invitations.length} pending
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {invitations.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No invitations waiting right now.
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
                    Role: {invitation.role} &middot; Expires{" "}
                    {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAcceptInvitation(invitation.id)}
                  disabled={loadingInvitationId === invitation.id}
                >
                  {loadingInvitationId === invitation.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Accept
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "without deadline";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(value));
}
