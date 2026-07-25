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
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import { organizationsClient } from "@/src/client/organizations";
import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { applicabilityCheckClient } from "@/src/client/applicability-check";
import { CountrySelector } from "./country-selector";
import type { Locale } from "@/lib/i18n-config";

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
  const [organizationForm, setOrganizationForm] = useState(
    defaultOrganizationForm,
  );
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingOrganization(true);
    setNotice({ message: null, tone: "default" });

    try {
      const result = await organizationsClient.create({
          name: organizationForm.name,
          legalName: organizationForm.legalName || null,
          country: organizationForm.country || "DE",
      });
      const organizationHref = `/tool/organizations/${result.data.organization.id}`;
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

      <Card className="w-full rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>{labels.createTitle}</CardTitle>
              <CardDescription>
                {labels.createDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6" onSubmit={handleCreateOrganization}>
            <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="organization-name">{labels.organizationName}</Label>
              <Input
                id="organization-name"
                placeholder={labels.organizationNamePlaceholder}
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
              <Label htmlFor="legal-name">{labels.legalName}</Label>
              <Input
                id="legal-name"
                placeholder={labels.legalNamePlaceholder}
                value={organizationForm.legalName}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,
                    legalName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2 lg:col-span-2 lg:max-w-md">
              <Label htmlFor="country">{labels.country}</Label>
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
            <Button type="submit" className="justify-self-start" disabled={isCreatingOrganization}>
              {isCreatingOrganization ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Building2 />
              )}
              {isCreatingOrganization ? labels.createPending : labels.createButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
