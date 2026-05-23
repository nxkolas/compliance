import { redirect } from "next/navigation";
import { Suspense } from "react";

type LegacyTeamPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default function LegacyTeamPage({ params }: LegacyTeamPageProps) {
  return (
    <Suspense fallback={null}>
      <LegacyTeamRedirect params={params} />
    </Suspense>
  );
}

async function LegacyTeamRedirect({ params }: LegacyTeamPageProps) {
  const { organizationId } = await params;

  redirect(`/tool/organizations/${organizationId}/settings/team`);

  return null;
}
