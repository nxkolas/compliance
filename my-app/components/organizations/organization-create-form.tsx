"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import type { Locale } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";
import { applicabilityCheckClient } from "@/src/client/applicability-check";
import { organizationsClient } from "@/src/client/organizations";
import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { CountrySelector } from "./country-selector";

type CreateOrganizationState = {
  name: string;
  legalName: string;
  country: string;
};

type RequestState = {
  message: string | null;
  tone: "default" | "success" | "error";
};

type RedirectAfterCreate = "organization" | "assessment";

type GuestApplicabilityClaim = {
  checkId: string;
  token?: string;
};

const defaultOrganizationForm: CreateOrganizationState = {
  name: "",
  legalName: "",
  country: "DE",
};

export function OrganizationCreateForm({
  labels,
  redirectAfterCreate = "organization",
  guestApplicabilityClaim,
  locale,
}: {
  labels: Dictionary["organizationForm"];
  redirectAfterCreate?: RedirectAfterCreate;
  guestApplicabilityClaim?: GuestApplicabilityClaim;
  locale: Locale;
}) {
  const router = useRouter();

  const [organizationForm, setOrganizationForm] =
    useState<CreateOrganizationState>(defaultOrganizationForm);

  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);

  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });
  const fieldClassName =
    "h-12 w-full rounded-lg border-[1.5px] border-[#3D4049] !bg-white/[0.06] px-5 font-['Space_Grotesk'] text-base font-normal leading-5 text-white shadow-sm placeholder:text-zinc-500 focus-visible:border-blue-700 focus-visible:ring-blue-700/40";
  const labelClassName =
    "flex min-h-5 w-full items-start font-['Space_Grotesk'] text-base leading-5 font-semibold text-white";
  const descriptionClassName =
    "flex min-h-9 w-full max-w-96 items-start break-words font-['Space_Grotesk'] text-xs leading-5 font-normal text-gray-400";

  async function handleCreateOrganization(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setIsCreatingOrganization(true);
    setNotice({
      message: null,
      tone: "default",
    });

    try {
      const result = await organizationsClient.create({
        name: organizationForm.name,
        legalName: organizationForm.legalName || null,
        country: organizationForm.country || "DE",
      });

      const organizationHref =
        `/tool/organizations/${result.data.organization.id}`;

      if (guestApplicabilityClaim) {
        await applicabilityCheckClient.claim({
          organizationId: result.data.organization.id,
          checkId: guestApplicabilityClaim.checkId,
          token: guestApplicabilityClaim.token,
        });

        router.push(`${organizationHref}/applicability-check/result`);
        router.refresh();
        return;
      }

      router.push(
        redirectAfterCreate === "assessment"
          ? `${organizationHref}/applicability-check/new`
          : organizationHref,
      );

      router.refresh();
    } catch (error) {
      setNotice({
        message: localizeUiError(error, {
          fallback: labels.createErrorFallback,
        }),
        tone: "error",
      });
    } finally {
      setIsCreatingOrganization(false);
    }
  }

  return (
    <div className="w-full min-w-0">
      {notice.message && (
        <Alert
          className={cn(
            "mb-6 break-words rounded-lg border px-4 py-3 text-sm",
            notice.tone === "success" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
            notice.tone === "error" &&
              "border-red-500/40 bg-red-500/10 text-red-200",
            notice.tone === "default" &&
              "border-zinc-700 bg-gray-900 text-gray-200",
          )}
        >
          <AlertDescription className="break-words text-inherit">
            {notice.message}
          </AlertDescription>
        </Alert>
      )}

      <Card
        className="
          box-border
          w-full
          min-w-0
          rounded-xl
          border-[1.5px]
          border-[#3D4049]
          bg-[#1B1E27]
          py-0
          font-['Space_Grotesk']
          shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)]
          gap-0
        "
      >
        <form
          onSubmit={handleCreateOrganization}
          className="
          box-border
          w-full
          min-w-0
          p-5
          sm:p-8
          font-['Space_Grotesk']
          inline-flex
          flex-col
          items-start
          gap-6
        "
      >
        {/* Organisationsname */}
        <div className="flex w-full min-w-0 flex-col items-start gap-0">
          <Label
            htmlFor="organization-name"
            className={labelClassName}
          >
            {labels.organizationName}
          </Label>

          <p className={descriptionClassName}>
            {labels.organizationNameHelp}
          </p>

          <Input
            id="organization-name"
            name="organizationName"
            placeholder={labels.organizationNamePlaceholder}
            value={organizationForm.name}
            onChange={(event) =>
              setOrganizationForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            required
            className={fieldClassName}
          />
        </div>

        {/* Rechtlicher Name */}
        <div className="flex w-full min-w-0 flex-col items-start gap-0">
          <Label
            htmlFor="legal-name"
            className={labelClassName}
          >
            {labels.legalName}
          </Label>

          <p className={descriptionClassName}>
            {labels.legalNameHelp}
          </p>

          <Input
            id="legal-name"
            name="legalName"
            placeholder={labels.legalNamePlaceholder}
            value={organizationForm.legalName}
            onChange={(event) =>
              setOrganizationForm((current) => ({
                ...current,
                legalName: event.target.value,
              }))
            }
            className={fieldClassName}
          />
        </div>

        {/* Land */}
        <div
          className="
            flex
            w-full
            min-w-0
            max-w-[506px]
            flex-col
            items-start
            gap-0
          "
        >
          <Label
            htmlFor="country"
            className={labelClassName}
          >
            {labels.country}
          </Label>

          <p className={descriptionClassName}>
            {labels.countryHelp}
          </p>

          <div
            className="
              h-12
              w-full
              min-w-0

              [&_[data-slot=select-trigger]]:inline-flex
              [&_[data-slot=select-trigger]]:h-12
              [&_[data-slot=select-trigger]]:w-full
              [&_[data-slot=select-trigger]]:min-w-0
              [&_[data-slot=select-trigger]]:items-center
              [&_[data-slot=select-trigger]]:justify-between
              [&_[data-slot=select-trigger]]:rounded-lg
              [&_[data-slot=select-trigger]]:border-[1.5px]
              [&_[data-slot=select-trigger]]:border-[#3D4049]
              [&_[data-slot=select-trigger]]:!bg-white/[0.06]
              [&_[data-slot=select-trigger]]:px-5
              [&_[data-slot=select-trigger]]:py-0
              [&_[data-slot=select-trigger]]:font-['Space_Grotesk']
              [&_[data-slot=select-trigger]]:text-base
              [&_[data-slot=select-trigger]]:font-normal
              [&_[data-slot=select-trigger]]:leading-6
              [&_[data-slot=select-trigger]]:text-white
              [&_[data-slot=select-trigger]]:shadow-sm
              [&_[data-slot=select-trigger]]:focus-visible:border-blue-700
              [&_[data-slot=select-trigger]]:focus-visible:ring-blue-700/40
              [&_[data-slot=select-trigger]_svg]:size-5
              [&_[data-slot=select-trigger]_svg]:text-slate-400
            "
          >
            <CountrySelector
              id="country"
              value={organizationForm.country}
              locale={locale}
              onChange={(country) =>
                setOrganizationForm((current) => ({
                  ...current,
                  country,
                }))
              }
            />
          </div>
        </div>

        {/* Organisation erstellen */}
        <Button
          type="submit"
          disabled={isCreatingOrganization}
          className="
            inline-flex
            min-h-12
            w-full
            items-center
            justify-center
            gap-2
            overflow-hidden
            self-end
            rounded-lg
            bg-[#002BFF]
            px-5
            py-3
            font-['Space_Grotesk']
            text-sm
            font-medium
            text-white
            whitespace-normal
            hover:bg-[#002BFF]/90
            focus-visible:ring-2
            focus-visible:ring-blue-400
            focus-visible:ring-offset-2
            focus-visible:ring-offset-gray-900
            disabled:cursor-not-allowed
            disabled:opacity-50
            sm:h-12
            sm:w-72
            sm:py-0
            sm:text-base
            sm:whitespace-nowrap
          "
        >
          {isCreatingOrganization ? (
            <>
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              <span className="min-w-0 text-center">
                {labels.createPending}
              </span>
            </>
          ) : (
            <>
              <Building2 className="size-4" aria-hidden="true" />
              <span className="min-w-0 text-center">
                {labels.createButton}
              </span>
            </>
          )}
        </Button>
        </form>
      </Card>
    </div>
  );
}
