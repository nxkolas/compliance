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
import type { Dictionary } from "@/lib/i18n";
import type { OrganizationDto } from "@/src/server/organizations/types";
import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CreateOrganizationState = {
  name: string;
  legalName: string;
  employeeCount: string;
  size: "" | "micro" | "small" | "medium" | "large";
  countryCode: string;
};

type RequestState = {
  message: string | null;
  tone: "default" | "success" | "error";
};

type CreateOrganizationResponse = {
  organization?: OrganizationDto;
  error?: string;
};

type RedirectAfterCreate = "organization" | "assessment";

const defaultOrganizationForm: CreateOrganizationState = {
  name: "",
  legalName: "",
  employeeCount: "",
  size: "",
  countryCode: "DE",
};

export function OrganizationCreateForm({
  labels,
  redirectAfterCreate = "organization",
}: {
  labels: Dictionary["organizationForm"];
  redirectAfterCreate?: RedirectAfterCreate;
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

      const body = (await response.json()) as CreateOrganizationResponse;

      if (!response.ok || !body.organization) {
        throw new Error(body.error ?? labels.createError);
      }

      const organizationHref = `/tool/organizations/${body.organization.id}`;
      router.push(
        redirectAfterCreate === "assessment"
          ? `${organizationHref}/applicability-check/new`
          : organizationHref,
      );
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : labels.createErrorFallback,
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

      <Card className="rounded-lg shadow-sm">
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
          <form className="grid gap-4" onSubmit={handleCreateOrganization}>
            <div className="grid gap-2">
              <Label htmlFor="organization-name">{labels.organizationName}</Label>
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
              <Label htmlFor="legal-name">{labels.legalName}</Label>
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
                <Label htmlFor="employee-count">{labels.employees}</Label>
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
                <Label htmlFor="organization-size">{labels.size}</Label>
                <Select
                  value={organizationForm.size || "unknown"}
                  onValueChange={(value) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      size:
                        value === "unknown"
                          ? ""
                          : (value as CreateOrganizationState["size"]),
                    }))
                  }
                >
                  <SelectTrigger id="organization-size">
                    <SelectValue placeholder={labels.sizeOptions.unknown} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">{labels.sizeOptions.unknown}</SelectItem>
                    <SelectItem value="micro">{labels.sizeOptions.micro}</SelectItem>
                    <SelectItem value="small">{labels.sizeOptions.small}</SelectItem>
                    <SelectItem value="medium">{labels.sizeOptions.medium}</SelectItem>
                    <SelectItem value="large">{labels.sizeOptions.large}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country-code">{labels.country}</Label>
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
              {isCreatingOrganization ? labels.createPending : labels.createButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
