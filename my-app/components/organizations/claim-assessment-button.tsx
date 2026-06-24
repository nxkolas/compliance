"use client";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimGuestAssessmentForOrganization } from "./claim-guest-assessment";

type ClaimAssessmentButtonProps = {
  assessmentId: string;
  organizationId: string;
  labels: Pick<
    Dictionary["assessment"],
    "addAssessment" | "addingAssessment" | "claimError"
  >;
};

export function ClaimAssessmentButton({
  assessmentId,
  organizationId,
  labels,
}: ClaimAssessmentButtonProps) {
  const router = useRouter();
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string>();

  async function handleClaim() {
    setIsClaiming(true);
    setError(undefined);

    try {
      const claimed = await claimGuestAssessmentForOrganization({
        assessmentId,
        organizationId,
        fallbackError: labels.claimError,
      });

      router.replace(
        `/tool/organizations/${claimed.organizationId}/applicability-check/${claimed.assessmentId}/result`,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.claimError);
      setIsClaiming(false);
    }
  }

  return (
    <div className="grid gap-2 justify-self-start">
      <Button
        type="button"
        variant="outline"
        onClick={handleClaim}
        disabled={isClaiming}
      >
        {isClaiming ? (
          <Loader2 className="animate-spin" />
        ) : (
          <ClipboardCheck />
        )}
        {isClaiming ? labels.addingAssessment : labels.addAssessment}
      </Button>
      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
