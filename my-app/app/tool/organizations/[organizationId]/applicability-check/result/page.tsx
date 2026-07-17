import { ApplicabilityResultCard } from "@/components/applicability-check/applicability-result-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getApplicabilityResultForUser } from "@/src/server/applicability-check/service";
import { ArrowLeft, ClipboardList, RefreshCw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

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
  const result = await getApplicabilityResultForUser(user.id, organizationId);

  if (!result) {
    redirect(`/tool/organizations/${organizationId}/applicability-check/new`);
  }

  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;
  const labels = dictionary.modules.applicabilityCheck.result;
  const resultTitle =
    locale === "en"
      ? result.result.labelEn ?? result.result.label
      : result.result.label;

  return (
    <section className="flex w-full flex-col gap-8">
      <PageHeader
        title={labels.title}
        subtitle={dictionary.modules.applicabilityCheck.description}
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={baseHref}>
            <ArrowLeft />
            {labels.overview}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`${baseHref}/answers`}>
            <ClipboardList />
            {labels.answers}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`${baseHref}/new`}>
            <RefreshCw />
            {labels.recalculate}
          </Link>
        </Button>
      </div>

      <ApplicabilityResultCard
        result={result}
        locale={locale}
        labels={labels}
        title={resultTitle}
        startCurrentHref={`${baseHref}/new`}
      />
    </section>
  );
}
