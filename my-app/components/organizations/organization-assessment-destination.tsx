import { ClaimAssessmentButton } from "@/components/organizations/claim-assessment-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import type { OrganizationDto } from "@/src/server/organizations/types";
import { Building2, ClipboardCheck, Plus, Users } from "lucide-react";
import Link from "next/link";

type OrganizationAssessmentDestinationProps = {
  title: string;
  description: string;
  newOrganizationHref: string;
  organizations: OrganizationDto[];
  labels: {
    assessment: Dictionary["assessment"];
    common: Dictionary["common"];
    organizations: Dictionary["organizations"];
  };
  action:
    | { kind: "create-assessment" }
    | { kind: "claim-assessment"; assessmentId: string };
};

export function OrganizationAssessmentDestination({
  title,
  description,
  newOrganizationHref,
  organizations,
  labels,
  action,
}: OrganizationAssessmentDestinationProps) {
  const sortedOrganizations = [...organizations].sort((a, b) =>
    a.name.localeCompare(b.name, "de", { sensitivity: "base" }),
  );

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="max-w-2xl text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={newOrganizationHref}>
              <Plus />
              {labels.organizations.newOrganization}
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {labels.organizations.yourOrganizations}
            </h2>
            <p className="text-sm text-muted-foreground">
              {labels.organizations.workspaceDescription}
            </p>
          </div>
          <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            {organizations.length} {labels.organizations.total}
          </span>
        </div>

        {sortedOrganizations.length === 0 ? (
          <Card className="rounded-lg border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {labels.organizations.noOrganization}
                </p>
                <p className="text-sm text-muted-foreground">
                  {labels.organizations.createFirst}
                </p>
              </div>
              <Button asChild className="mt-2">
                <Link href={newOrganizationHref}>
                  <Plus />
                  {labels.organizations.newOrganization}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedOrganizations.map((organization) => (
              <Card key={organization.id} className="rounded-lg shadow-sm">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {organization.name}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {organization.legalName ||
                          labels.organizations.legalNameEmpty}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border px-2 py-1">
                      {organization.size ?? labels.common.sizeUnknown}
                    </span>
                    <span className="rounded-md border px-2 py-1">
                      {organization.countryCode ?? "DE"}
                    </span>
                    {organization.employeeCount !== null && (
                      <span className="rounded-md border px-2 py-1">
                        {organization.employeeCount} {labels.common.employees}
                      </span>
                    )}
                  </div>
                  {action.kind === "claim-assessment" ? (
                    <ClaimAssessmentButton
                      assessmentId={action.assessmentId}
                      organizationId={organization.id}
                      labels={labels.assessment}
                    />
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      className="justify-self-start"
                    >
                      <Link
                        href={`/tool/organizations/${organization.id}/applicability-check/new`}
                      >
                        <ClipboardCheck />
                        {labels.assessment.newAssessment}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
