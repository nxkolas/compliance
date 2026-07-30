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
import type { OrganizationDto } from "@/src/server/organizations/types";
import { Building2, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { organizationsClient } from "@/src/client/organizations";

type SerializedOrganization = SerializeDates<OrganizationDto>;

type OrganizationSettingsFormProps = {
  organization: SerializedOrganization;
  labels: Dictionary["organizationForm"];
};

type OrganizationFormState = {
  name: string;
  legalName: string;
  country: string;
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
    country: organization.country ?? "DE",
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
      await organizationsClient.update(organization.id, {
          name: form.name,
          legalName: form.legalName || null,
          country: form.country || "DE",
        }, organization.version);

      setNotice({
        message: labels.saveSuccess,
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message: localizeUiError(error, {
          fallback: labels.updateErrorFallback,
        }),
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
            <div className="grid gap-2 sm:max-w-40">
              <Label htmlFor="country">{labels.country}</Label>
              <Input
                id="country"
                maxLength={2}
                value={form.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value.toUpperCase(),
                  }))
                }
              />
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
