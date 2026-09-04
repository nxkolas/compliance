import { requireAuth } from "@/src/supabase/require-auth";
import { getApplicabilityOverviewForUser } from "@/src/server/modules/applicability-check";
import { redirect } from "next/navigation";
import { connection } from "next/server";

type ApplicabilityCheckPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function ApplicabilityCheckPage({
  params,
}: ApplicabilityCheckPageProps) {
  await connection();
  const user = await requireAuth();
  const { organizationId } = await params;
  const overview = await getApplicabilityOverviewForUser(
    user.id,
    organizationId,
  );
  const baseHref = `/tool/organizations/${organizationId}/applicability-check`;

  return redirect(overview?.result ? `${baseHref}/result` : `${baseHref}/new`);
}
