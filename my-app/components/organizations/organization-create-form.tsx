"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="w-[1205px] min-w-[1205px] max-w-none shrink-0">
      {notice.message && (
        <div
          role="alert"
          className={cn(
            "mb-6 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "success" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
            notice.tone === "error" &&
              "border-red-500/40 bg-red-500/10 text-red-200",
            notice.tone === "default" &&
              "border-zinc-700 bg-gray-900 text-gray-200",
          )}
        >
          {notice.message}
        </div>
      )}

      <form
        onSubmit={handleCreateOrganization}
        className="
          relative
          box-border
          h-[522px]
          w-[1205px]
min-w-[1205px]
max-w-none
          overflow-hidden
          rounded-xl
          border-[1.5px]
          border-zinc-700
          bg-gray-900
          font-['Space_Grotesk']
          shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)]
        "
      >
        {/* Organisationsname */}
        <div className="absolute left-8 right-8 top-8 flex flex-col gap-2">
          <label
            htmlFor="organization-name"
            className="h-5 text-base font-semibold leading-5 text-white"
          >
            {labels.organizationName}
          </label>

          <p className="h-5 text-xs font-normal leading-5 text-gray-400">
            Interner Anzeigename für deinen Workspace.
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
            className="
              h-12
              w-full
              rounded-lg
              border-0
              bg-white/5
              px-5
              font-['Space_Grotesk']
              text-base
              font-normal
              leading-6
              text-white
              shadow-none
              outline
              outline-[1.5px]
              outline-offset-[-1.5px]
              outline-zinc-700
              placeholder:text-gray-500
              focus-visible:ring-0
              focus-visible:ring-offset-0
            "
          />
        </div>

        {/* Rechtlicher Name */}
        <div className="absolute left-8 right-8 top-[174px] flex flex-col gap-2">
          <label
            htmlFor="legal-name"
            className="h-5 text-base font-semibold leading-5 text-white"
          >
            {labels.legalName}
          </label>

          <p className="h-5 text-xs font-normal leading-5 text-gray-400">
            Offizieller Firmenname laut Handelsregister.
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
            className="
              h-12
              w-full
              rounded-lg
              border-0
              bg-white/5
              px-5
              font-['Space_Grotesk']
              text-base
              font-normal
              leading-6
              text-white
              shadow-none
              outline
              outline-[1.5px]
              outline-offset-[-1.5px]
              outline-zinc-700
              placeholder:text-gray-500
              focus-visible:ring-0
              focus-visible:ring-offset-0
            "
          />
        </div>

        {/* Land */}
        <div
          className="
            absolute
            left-8
            right-8
            top-[313px]
            flex
            max-w-[506px]
            flex-col
            gap-2
          "
        >
          <label
            htmlFor="country"
            className="h-5 text-base font-semibold leading-5 text-white"
          >
            {labels.country}
          </label>

          <p className="h-5 text-xs font-normal leading-5 text-gray-400">
            Land, in dem die Organisation registriert ist.
          </p>

          <div
            className="
              h-12
              w-full

              [&_[data-slot=select-trigger]]:inline-flex
              [&_[data-slot=select-trigger]]:h-12
              [&_[data-slot=select-trigger]]:w-full
              [&_[data-slot=select-trigger]]:items-center
              [&_[data-slot=select-trigger]]:justify-between
              [&_[data-slot=select-trigger]]:rounded-lg
              [&_[data-slot=select-trigger]]:border-0
              [&_[data-slot=select-trigger]]:bg-gray-800
              [&_[data-slot=select-trigger]]:px-5
              [&_[data-slot=select-trigger]]:py-0
              [&_[data-slot=select-trigger]]:font-['Space_Grotesk']
              [&_[data-slot=select-trigger]]:text-base
              [&_[data-slot=select-trigger]]:font-normal
              [&_[data-slot=select-trigger]]:leading-6
              [&_[data-slot=select-trigger]]:text-white
              [&_[data-slot=select-trigger]]:shadow-none
              [&_[data-slot=select-trigger]]:outline
              [&_[data-slot=select-trigger]]:outline-[1.5px]
              [&_[data-slot=select-trigger]]:outline-offset-[-1.5px]
              [&_[data-slot=select-trigger]]:outline-zinc-700
              [&_[data-slot=select-trigger]]:focus:ring-0
              [&_[data-slot=select-trigger]]:focus-visible:ring-0
              [&_[data-slot=select-trigger]]:focus-visible:ring-offset-0
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
            absolute
            bottom-8
            right-8
            inline-flex
            h-12
            w-72
            items-center
            justify-center
            gap-2
            overflow-hidden
            rounded-lg
            bg-blue-700
            px-6
            font-['Space_Grotesk']
            text-base
            font-medium
            text-white
            hover:bg-blue-600
            focus-visible:ring-2
            focus-visible:ring-blue-400
            focus-visible:ring-offset-2
            focus-visible:ring-offset-gray-900
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {isCreatingOrganization ? (
            <>
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              <span>{labels.createPending}</span>
            </>
          ) : (
            <>
              <Building2 className="size-4" aria-hidden="true" />
              <span>{labels.createButton}</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
