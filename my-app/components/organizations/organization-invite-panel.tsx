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
import type {
  OrganizationInvitationDto,
  OrganizationRole,
} from "@/src/server/organizations/types";
import { Loader2, Send } from "lucide-react";
import { FormEvent, useState } from "react";

type SerializedInvitation = SerializeDates<OrganizationInvitationDto>;

type OrganizationInvitePanelProps = {
  organizationId: string;
  initialInvitations: SerializedInvitation[];
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
}: OrganizationInvitePanelProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteForm, setInviteForm] = useState<InviteState>({
    email: "",
    role: "member",
  });
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingInvitation(true);
    setNotice({ message: null, tone: "default" });

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(inviteForm),
        },
      );

      const body = (await response.json()) as {
        invitation?: SerializedInvitation;
        error?: string;
      };

      if (!response.ok || !body.invitation) {
        throw new Error(body.error ?? "Invitation could not be created");
      }

      setInvitations((current) => [body.invitation!, ...current]);
      setInviteForm((current) => ({
        email: "",
        role: current.role,
      }));
      setNotice({
        message: `Invitation for ${body.invitation.email} is now in their inbox.`,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Invitation creation failed",
        tone: "error",
      });
    } finally {
      setIsCreatingInvitation(false);
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
          <CardTitle>Invite teammate</CardTitle>
          <CardDescription>
            Send an invitation to this organization by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleCreateInvitation}>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teammate@example.com"
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
                <Label htmlFor="invite-role">Role</Label>
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
                        {role}
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
                  Invite
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>Invitation history</CardTitle>
          <CardDescription>
            Recent invitations created for this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {invitations.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No invitations have been sent yet.
            </div>
          ) : (
            invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Role: {invitation.role} &middot; Expires{" "}
                    {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
                  {invitation.status}
                </span>
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
