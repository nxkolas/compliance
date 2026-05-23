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
import { Building2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SerializedOrganization = SerializeDates<OrganizationDto>;

type OrganizationSettingsFormProps = {
  organization: SerializedOrganization;
  labels: Dictionary["organizationForm"];
};

type OrganizationFormState = {
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

export function OrganizationSettingsForm({
  organization,
  labels,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<OrganizationFormState>({
    name: organization.name,
    legalName: organization.legalName ?? "",
    employeeCount:
      organization.employeeCount === null ? "" : String(organization.employeeCount),
    size: organization.size ?? "",
    countryCode: organization.countryCode ?? "DE",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice({ message: null, tone: "default" });

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          legalName: form.legalName || null,
          employeeCount: form.employeeCount ? Number(form.employeeCount) : null,
          size: form.size || null,
          countryCode: form.countryCode || "DE",
        }),
      });

      const body = (await response.json()) as {
        organization?: SerializedOrganization;
        error?: string;
      };

      if (!response.ok || !body.organization) {
        throw new Error(body.error ?? labels.updateError);
      }

      setNotice({
        message: labels.saveSuccess,
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : labels.updateErrorFallback,
        tone: "error",
      });
    } finally {
      setIsSaving(false);
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
              <CardTitle>{labels.dataTitle}</CardTitle>
              <CardDescription>
                {labels.dataDescription}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="organization-name">{labels.organizationName}</Label>
              <Input
                id="organization-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
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
                value={form.legalName}
                onChange={(event) =>
                  setForm((current) => ({
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
                  type="number"
                  value={form.employeeCount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      employeeCount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization-size">{labels.size}</Label>
                <Select
                  value={form.size || "unknown"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      size:
                        value === "unknown"
                          ? ""
                          : (value as OrganizationFormState["size"]),
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
                  value={form.countryCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      countryCode: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {isSaving ? labels.savePending : labels.saveButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
