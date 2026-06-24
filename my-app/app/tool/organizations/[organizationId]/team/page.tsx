import { redirect } from "next/navigation";

type LegacyTeamPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function LegacyTeamPage({ params }: LegacyTeamPageProps) {
  const { organizationId } = await params;

  redirect(`/tool/organizations/${organizationId}/settings/team`);
}
