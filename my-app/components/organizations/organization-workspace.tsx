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
import { cn } from "@/lib/utils";
import type {
  OrganizationDto,
  OrganizationMailboxInvitationDto,
  OrganizationRole,
} from "@/src/server/organizations/types";
import {
  Building2,
  Check,
  Inbox,
  Loader2,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type SerializedOrganization = SerializeDates<OrganizationDto>;
type SerializedMailboxInvitation =
  SerializeDates<OrganizationMailboxInvitationDto>;

type OrganizationWorkspaceProps = {
  initialOrganizations: SerializedOrganization[];
  initialInvitations: SerializedMailboxInvitation[];
  userEmail: string | null;
};

type CreateOrganizationState = {
  name: string;
  legalName: string;
  employeeCount: string;
  size: "" | "micro" | "small" | "medium" | "large";
  countryCode: string;
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

const defaultOrganizationForm: CreateOrganizationState = {
  name: "",
  legalName: "",
  employeeCount: "",
  size: "",
  countryCode: "DE",
};

const roleOptions: Array<InviteState["role"]> = ["member", "admin", "auditor"];

export function OrganizationWorkspace({
  initialOrganizations,
  initialInvitations,
  userEmail,
}: OrganizationWorkspaceProps) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [organizationForm, setOrganizationForm] = useState(
    defaultOrganizationForm,
  );
  const [inviteForms, setInviteForms] = useState<Record<string, InviteState>>(
    {},
  );
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [loadingInvitationId, setLoadingInvitationId] = useState<string | null>(
    null,
  );
  const [loadingInviteOrganizationId, setLoadingInviteOrganizationId] = useState<
    string | null
  >(null);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  const sortedOrganizations = useMemo(
    () =>
      [...organizations].sort((a, b) =>
        a.name.localeCompare(b.name, "de", { sensitivity: "base" }),
      ),
    [organizations],
  );

  async function refreshWorkspace() {
    const [organizationsResponse, invitationsResponse] = await Promise.all([
      fetch("/api/organizations"),
      fetch("/api/organization-invitations"),
    ]);

    if (organizationsResponse.ok) {
      const body = (await organizationsResponse.json()) as {
        organizations: SerializedOrganization[];
      };
      setOrganizations(body.organizations);
    }

    if (invitationsResponse.ok) {
      const body = (await invitationsResponse.json()) as {
        invitations: SerializedMailboxInvitation[];
      };
      setInvitations(body.invitations);
    }
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingOrganization(true);
    setNotice({ message: null, tone: "default" });

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: organizationForm.name,
          legalName: organizationForm.legalName || null,
          employeeCount: organizationForm.employeeCount
            ? Number(organizationForm.employeeCount)
            : null,
          size: organizationForm.size || null,
          countryCode: organizationForm.countryCode || "DE",
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Organization could not be created");
      }

      setOrganizations((current) => [...current, body.organization]);
      setOrganizationForm(defaultOrganizationForm);
      setNotice({
        message: "Organization created.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Organization creation failed",
        tone: "error",
      });
    } finally {
      setIsCreatingOrganization(false);
    }
  }

  async function handleCreateInvitation(
    event: FormEvent<HTMLFormElement>,
    organizationId: string,
  ) {
    event.preventDefault();
    const form = inviteForms[organizationId] ?? {
      email: "",
      role: "member",
    };

    setLoadingInviteOrganizationId(organizationId);
    setNotice({ message: null, tone: "default" });

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Invitation could not be created");
      }

      setInviteForms((current) => ({
        ...current,
        [organizationId]: {
          email: "",
          role: form.role,
        },
      }));
      setNotice({
        message: `Invitation for ${body.invitation.email} is now in their postbox.`,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Invitation creation failed",
        tone: "error",
      });
    } finally {
      setLoadingInviteOrganizationId(null);
    }
  }

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
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Invitation could not be accepted");
      }

      setNotice({
        message: "Invitation accepted.",
        tone: "success",
      });
      await refreshWorkspace();
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

  function updateInviteForm(
    organizationId: string,
    update: Partial<InviteState>,
  ) {
    setInviteForms((current) => ({
      ...current,
      [organizationId]: {
        email: current[organizationId]?.email ?? "",
        role: current[organizationId]?.role ?? "member",
        ...update,
      },
    }));
  }

  return (
    <div className="flex flex-col gap-6">
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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Create organization</CardTitle>
                <CardDescription>
                  Start a compliance workspace for one legal entity.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleCreateOrganization}>
              <div className="grid gap-2">
                <Label htmlFor="organization-name">Organization name</Label>
                <Input
                  id="organization-name"
                  placeholder="Example GmbH"
                  value={organizationForm.name}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="legal-name">Legal name</Label>
                <Input
                  id="legal-name"
                  placeholder="Example GmbH"
                  value={organizationForm.legalName}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      legalName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_0.8fr_0.55fr]">
                <div className="grid gap-2">
                  <Label htmlFor="employee-count">Employees</Label>
                  <Input
                    id="employee-count"
                    inputMode="numeric"
                    min={0}
                    placeholder="85"
                    type="number"
                    value={organizationForm.employeeCount}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        employeeCount: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="organization-size">Size</Label>
                  <select
                    id="organization-size"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={organizationForm.size}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        size: event.target.value as CreateOrganizationState["size"],
                      }))
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="micro">Micro</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country-code">Country</Label>
                  <Input
                    id="country-code"
                    maxLength={2}
                    value={organizationForm.countryCode}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        countryCode: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              </div>
              <Button type="submit" disabled={isCreatingOrganization}>
                {isCreatingOrganization ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Building2 />
                )}
                Create organization
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                  <Inbox className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Invitation postbox</CardTitle>
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
                      Role: {invitation.role} · Expires{" "}
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
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Your organizations</h2>
            <p className="text-sm text-muted-foreground">
              Manage workspace access and send internal invitations.
            </p>
          </div>
          <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            {organizations.length} total
          </span>
        </div>

        {sortedOrganizations.length === 0 ? (
          <Card className="rounded-lg border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No organization yet</p>
                <p className="text-sm text-muted-foreground">
                  Create the first workspace or accept an invitation from your
                  postbox.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sortedOrganizations.map((organization) => {
              const inviteForm = inviteForms[organization.id] ?? {
                email: "",
                role: "member",
              };

              return (
                <Card key={organization.id} className="rounded-lg shadow-sm">
                  <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
                    <div className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
                        <Users className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">
                          {organization.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {organization.legalName || "No legal name set"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-md border px-2 py-1">
                            {organization.size ?? "Size unknown"}
                          </span>
                          <span className="rounded-md border px-2 py-1">
                            {organization.countryCode ?? "DE"}
                          </span>
                          {organization.employeeCount !== null && (
                            <span className="rounded-md border px-2 py-1">
                              {organization.employeeCount} employees
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <form
                      className="grid gap-3 rounded-md border bg-muted/20 p-4"
                      onSubmit={(event) =>
                        handleCreateInvitation(event, organization.id)
                      }
                    >
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">Invite to postbox</p>
                        <p className="text-xs text-muted-foreground">
                          The invitation appears for this email after login.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-[1fr_130px_auto]">
                        <div className="grid gap-2">
                          <Label htmlFor={`invite-email-${organization.id}`}>
                            Email
                          </Label>
                          <Input
                            id={`invite-email-${organization.id}`}
                            type="email"
                            placeholder="teammate@example.com"
                            value={inviteForm.email}
                            onChange={(event) =>
                              updateInviteForm(organization.id, {
                                email: event.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`invite-role-${organization.id}`}>
                            Role
                          </Label>
                          <select
                            id={`invite-role-${organization.id}`}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={inviteForm.role}
                            onChange={(event) =>
                              updateInviteForm(organization.id, {
                                role: event.target.value as InviteState["role"],
                              })
                            }
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={
                              loadingInviteOrganizationId === organization.id
                            }
                          >
                            {loadingInviteOrganizationId === organization.id ? (
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
              );
            })}
          </div>
        )}
      </section>
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
