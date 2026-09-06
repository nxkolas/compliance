"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatDate as formatLocalizedDate } from "@/lib/i18n/format";
import { localizeUiError } from "@/lib/i18n/errors";
import type { OrganizationMailboxInvitationDto } from "@/src/server/organizations/types";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { organizationsClient } from "@/src/client/organizations";
import { OrganizationAvatar } from "./organization-avatar";

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

      <Card
        data-inbox-card
        className={cn(
          "w-full min-w-0 gap-0 rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] py-0 text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)]",
          invitations.length === 0 ? "min-h-96" : "min-h-[320px]",
        )}
      >
        <CardHeader className="min-h-[89px] px-5 py-5 sm:px-8 xl:px-[46px]">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
            <div className="flex min-w-0 items-center gap-4">
              <InvitationMailIcon />
              <div className="min-w-0">
                <p className="text-sm leading-4 font-normal text-zinc-300">
                  {labels.pendingFor}
                </p>
                <p className="mt-1 truncate text-base leading-5 font-semibold text-white">
                  {userEmail ?? labels.yourAccount}
                </p>
              </div>
            </div>
            <span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-[#002BFF] bg-[#002BFF]/30 px-4 text-xs leading-5 font-medium text-white">
              {invitations.length} {labels.pending}
            </span>
          </div>
        </CardHeader>
        {invitations.length === 0 ? (
          <CardContent
            data-inbox-empty-state
            className="flex min-h-[294px] items-center justify-center border-t-[1.5px] border-[#3D4049] px-4 py-10 sm:px-8"
          >
            <div className="flex max-w-2xl flex-col items-center text-center">
              <InvitationInboxEmptyIcon />
              <h2 className="mt-6 text-lg leading-5 font-medium text-white">
                {labels.emptyTitle}
              </h2>
              <p className="mt-4 text-sm leading-6 font-normal text-zinc-300 sm:text-base">
                {labels.emptyDescription}
              </p>
            </div>
          </CardContent>
        ) : (
          <CardContent
            data-inbox-invitations
            className="grid gap-4 border-t-[1.5px] border-[#3D4049] px-4 py-6 sm:px-6 sm:py-8 xl:px-7"
          >
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                data-inbox-invitation
                className="grid min-h-36 gap-6 rounded-xl border-[1.5px] border-[#3D4049] bg-[#252832] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
              >
                <div className="flex min-w-0 items-start gap-5 sm:self-stretch">
                  <OrganizationAvatar
                    id={invitation.organization.id}
                    name={invitation.organization.name}
                    className="mt-0.5 size-7 rounded-full text-[9px] leading-3"
                  />
                  <div className="flex min-w-0 flex-1 flex-col text-white">
                    <p className="truncate text-base leading-5 font-semibold">
                      {invitation.organization.name}
                    </p>
                    <p className="mt-1 truncate text-sm leading-5 font-normal">
                      {labels.invitedByOrganization.replace(
                        "{organization}",
                        invitation.organization.name,
                      )}
                    </p>
                    <div className="mt-6 text-sm leading-5 font-normal">
                      <p>
                        {labels.role}: {labels.roles[invitation.role]}
                      </p>
                      <p>
                        {labels.expiresAt}{" "}
                        {formatDate(
                          invitation.expiresAt,
                          locale,
                          labels.withoutDeadline,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    disabled
                    title={labels.declineUnavailable}
                    className="h-10 w-full rounded-lg border border-white/70 bg-transparent px-4 text-base font-medium text-white/70 shadow-[0px_4px_4px_0px_rgba(255,255,255,0.25)] disabled:cursor-not-allowed disabled:opacity-100 sm:w-auto"
                  >
                    {labels.decline}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleAcceptInvitation(invitation.id)}
                    disabled={loadingInvitationId === invitation.id}
                    className="h-10 w-full cursor-pointer gap-1.5 rounded-lg bg-[#002BFF] px-4 text-base font-semibold text-white shadow-none hover:bg-[#123BFF] sm:w-auto disabled:cursor-not-allowed"
                  >
                    {loadingInvitationId === invitation.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" strokeWidth={1.46} />
                    )}
                    {labels.accept}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
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

function InvitationInboxEmptyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[101px] w-[132px] shrink-0"
      data-inbox-empty-icon
      fill="none"
      viewBox="0 0 132 101"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#inbox-empty-shadow)">
        <path
          d="M19.3047 99.0938C6.83594 99.0938 0 92.3125 0 79.8984V48.9453C0 41.1797 0.875 37.7891 4.53906 33.4141L22.8594 10.4453C29.2031 2.51562 33.8516 0 42.3281 0H89.5234C97.9453 0 102.594 2.51562 108.883 10.3359L127.258 33.4141C130.922 37.7891 131.797 41.1797 131.797 48.9453V79.8984C131.797 92.3125 125.016 99.0938 112.492 99.0938H19.3047ZM65.8984 63.9297C74.1562 63.9297 80.0625 57.0391 80.0625 49.6016V48.8359C80.0625 46.2109 81.6484 43.6953 84.875 43.6953H114.57C116.812 43.6953 117.25 41.7812 116.047 40.3594L96.4141 15.0938C94.3906 12.4688 91.9844 11.2656 88.7578 11.2656H42.7109C39.4297 11.2656 37.0781 12.4688 35.0547 15.0938L14.8203 41.0156C13.9453 42.2188 14.2734 43.6953 16.0234 43.6953H46.9219C50.2031 43.6953 51.7344 46.2109 51.7344 48.8359V49.6016C51.7344 57.0391 57.6406 63.9297 65.8984 63.9297Z"
          fill="#82848C"
        />
      </g>
      <defs>
        <filter
          id="inbox-empty-shadow"
          x="0"
          y="0"
          width="131.797"
          height="100.094"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="1" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.32 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="inboxEmptyDropShadow"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="inboxEmptyDropShadow"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
}

function InvitationMailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-9 shrink-0"
      data-inbox-mail-icon
      fill="none"
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id="inbox-mail-shape" fill="white">
        <path d="M0 8C0 3.58172 3.58172 0 8 0H28C32.4183 0 36 3.58172 36 8V28C36 32.4183 32.4183 36 28 36H8C3.58172 36 0 32.4183 0 28V8Z" />
      </mask>
      <path
        d="M0 8C0 3.58172 3.58172 0 8 0H28C32.4183 0 36 3.58172 36 8V28C36 32.4183 32.4183 36 28 36H8C3.58172 36 0 32.4183 0 28V8Z"
        fill="#1D2C71"
      />
      <path
        d="M8 0V1H28V0V-1H8V0ZM36 8H35V28H36H37V8H36ZM28 36V35H8V36V37H28V36ZM0 28H1V8H0H-1V28H0ZM8 36V35C4.13401 35 1 31.866 1 28H0H-1C-1 32.9706 3.02944 37 8 37V36ZM36 28H35C35 31.866 31.866 35 28 35V36V37C32.9706 37 37 32.9706 37 28H36ZM28 0V1C31.866 1 35 4.13401 35 8H36H37C37 3.02944 32.9706 -1 28 -1V0ZM8 0V-1C3.02944 -1 -1 3.02944 -1 8H0H1C1 4.13401 4.13401 1 8 1V0Z"
        fill="white"
        fillOpacity="0.1"
        mask="url(#inbox-mail-shape)"
      />
      <path
        d="M23.334 12.667H12.6673C11.9309 12.667 11.334 13.2639 11.334 14.0003V22.0003C11.334 22.7367 11.9309 23.3337 12.6673 23.3337H23.334C24.0704 23.3337 24.6673 22.7367 24.6673 22.0003V14.0003C24.6673 13.2639 24.0704 12.667 23.334 12.667Z"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.334 14.667L18.0007 19.3337L24.6673 14.667"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
