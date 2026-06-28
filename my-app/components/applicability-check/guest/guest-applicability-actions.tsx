"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { LogIn, Save, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type GuestApplicabilityActionsProps = {
  labels: Dictionary["modules"]["applicabilityCheck"]["guest"];
  isAuthenticated: boolean;
  guestToken?: string;
  returnPath: string;
};

export function GuestApplicabilityActions({
  labels,
  isAuthenticated,
  guestToken,
  returnPath,
}: GuestApplicabilityActionsProps) {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/guest/applicability-check/result", {
        method: "DELETE",
        headers: guestToken
          ? {
              "x-guest-applicability-token": guestToken,
            }
          : undefined,
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? labels.deleteError);
      }

      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/guest/applicability-check/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(guestToken
            ? { "x-guest-applicability-token": guestToken }
            : {}),
        },
        body: JSON.stringify({ organizationName }),
      });
      const body = (await response.json()) as {
        organizationId?: string;
        error?: string;
      };

      if (!response.ok || !body.organizationId) {
        throw new Error(body.error ?? labels.claimError);
      }

      router.replace(
        `/tool/organizations/${body.organizationId}/applicability-check/result`,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.claimError);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </div>
      ) : null}

      {isAuthenticated ? (
        <form className="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={handleClaim}>
          <div className="grid gap-2">
            <Label htmlFor="guest-organization-name">
              {labels.organizationName}
            </Label>
            <Input
              id="guest-organization-name"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder={labels.organizationNamePlaceholder}
              required
              maxLength={255}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isSaving} className="w-full">
              <Save />
              {isSaving ? labels.saving : labels.saveToAccount}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href={`/auth/sign-up?next=${encodeURIComponent(returnPath)}`}>
              <UserPlus />
              {labels.createAccount}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/auth/login?next=${encodeURIComponent(returnPath)}`}>
              <LogIn />
              {labels.signIn}
            </Link>
          </Button>
        </div>
      )}

      <div className="mt-4 flex justify-end border-t pt-4">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting || isSaving}
        >
          <Trash2 />
          {isDeleting ? labels.deleting : labels.deleteData}
        </Button>
      </div>
    </div>
  );
}
