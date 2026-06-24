import { OrganizationAssessmentWorkspace } from "@/components/organizations/organization-assessment-workspace";
import { getDictionary, getLocale } from "@/lib/i18n";
import { requireAuth } from "@/lib/supabase/require-auth";
import { listSelfCheckAssessmentsForOrganization } from "@/src/server/organizations/service";
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
  const dictionary = await getDictionary();
  const locale = await getLocale();
  const { organizationId } = await params;
  const assessments = await listSelfCheckAssessmentsForOrganization(
    user.id,
    organizationId,
  );

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            {dictionary.modules.applicabilityCheck.title}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {dictionary.modules.applicabilityCheck.description}
          </p>
        </div>
      </section>
      <OrganizationAssessmentWorkspace
        organizationId={organizationId}
        initialAssessments={serializeForClient(assessments)}
        labels={{
          assessment: dictionary.assessment,
          common: dictionary.common,
        }}
        locale={locale}
      />
    </div>
  );
}

function serializeForClient<T>(value: T): JSONValue<T> {
  return JSON.parse(JSON.stringify(value)) as JSONValue<T>;
}

type JSONValue<T> = T extends null
  ? null
  : T extends Date
    ? string
    : T extends Date | null
      ? string | null
      : T extends Array<infer U>
        ? Array<JSONValue<U>>
        : T extends object
          ? { [K in keyof T]: JSONValue<T[K]> }
          : T;
