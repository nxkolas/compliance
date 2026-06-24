export type ClaimedGuestAssessment = {
  organizationId: string;
  assessmentId: string;
};

export async function claimGuestAssessmentForOrganization({
  assessmentId,
  organizationId,
  fallbackError,
}: {
  assessmentId: string;
  organizationId: string;
  fallbackError: string;
}): Promise<ClaimedGuestAssessment> {
  const response = await fetch(`/api/guest-assessments/${assessmentId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ organizationId }),
  });
  const payload = (await response.json()) as {
    organizationId?: string;
    assessmentId?: string;
    error?: string;
  };

  if (!response.ok || !payload.organizationId || !payload.assessmentId) {
    throw new Error(payload.error ?? fallbackError);
  }

  return {
    organizationId: payload.organizationId,
    assessmentId: payload.assessmentId,
  };
}
