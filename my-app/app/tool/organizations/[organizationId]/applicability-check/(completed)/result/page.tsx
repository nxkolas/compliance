import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import { getDictionary, getLocale } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  getCompletedApplicabilityRecalculationLock,
  getCompletedApplicabilityResult,
} from "../data";

type ApplicabilityResultPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function ApplicabilityResultPage({
  params,
}: ApplicabilityResultPageProps) {
  await connection();
  const user = await requireAuth();
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const [result, recalculationLock] = await Promise.all([
    getCompletedApplicabilityResult(user.id, organizationId),
    getCompletedApplicabilityRecalculationLock(user.id, organizationId),
  ]);

  if (!result) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;
  const resultTitle =
    locale === "en"
      ? result.result.labelEn ?? result.result.label
      : result.result.label;

  return (
    <ApplicabilityResultCard
      result={result}
      locale={locale}
      labels={dictionary.modules.applicabilityCheck.result}
      title={resultTitle}
      startCurrentHref={`${baseHref}/new`}
      gapAnalysisHref={`/tool/organizations/${organizationId}/gap-analysis`}
      recalculationLocked={recalculationLock.locked}
    />
  );
}
