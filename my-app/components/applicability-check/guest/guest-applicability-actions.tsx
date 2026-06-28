"use client";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { Building2, LogIn, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type GuestApplicabilityActionsProps = {
  labels: Dictionary["modules"]["applicabilityCheck"]["guest"];
  isAuthenticated: boolean;
  guestToken?: string;
  guestCheckId: string;
};

export function GuestApplicabilityActions({
  labels,
  isAuthenticated,
  guestToken,
  guestCheckId,
}: GuestApplicabilityActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claimPathSearchParams = new URLSearchParams({
    guestApplicabilityCheck: guestCheckId,
  });

  if (guestToken) {
    claimPathSearchParams.set("claim", guestToken);
  }

  const claimPath = `/tool/organizations/new?${claimPathSearchParams.toString()}`;

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/guest/applicability-check/result", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(guestToken
            ? {
                "x-guest-applicability-token": guestToken,
              }
            : {}),
        },
        body: JSON.stringify({ checkId: guestCheckId }),
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 />
          {isDeleting ? labels.deleting : labels.deleteData}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            <Button asChild>
              <Link href={claimPath}>
                <Building2 />
                {labels.saveToAccount}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href={`/auth/login?next=${encodeURIComponent(claimPath)}`}>
                  <LogIn />
                  {labels.signIn}
                </Link>
              </Button>
              <Button asChild>
                <Link
                  href={`/auth/sign-up?next=${encodeURIComponent(claimPath)}`}
                >
                  <UserPlus />
                  {labels.createAccount}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
