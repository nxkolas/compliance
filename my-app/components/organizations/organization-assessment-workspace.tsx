"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SelfCheckAssessmentDto } from "@/src/server/organizations/types";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

type SerializedAssessment = SerializeDates<SelfCheckAssessmentDto>;

type OrganizationAssessmentWorkspaceProps = {
  organizationId: string;
  initialAssessments: SerializedAssessment[];
  labels: {
    assessment: Dictionary["assessment"];
    common: Dictionary["common"];
  };
  locale: Locale;
};

type SerializeDates<T> = {
  [K in keyof T]: T[K] extends null
    ? null
    : T[K] extends Date
      ? string
      : T[K] extends Date | null
        ? string | null
        : T[K] extends object
          ? SerializeDates<T[K]>
          : T[K];
};

export function OrganizationAssessmentWorkspace({
  organizationId,
  initialAssessments,
  labels,
  locale,
}: OrganizationAssessmentWorkspaceProps) {
  const statusCounts = useMemo(
    () =>
      initialAssessments.reduce<Record<string, number>>((counts, assessment) => {
        counts[assessment.status] = (counts[assessment.status] ?? 0) + 1;
        return counts;
      }, {}),
    [initialAssessments],
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-6">
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{labels.assessment.overviewTitle}</CardTitle>
                <CardDescription>
                  {labels.assessment.overviewDescription}
                </CardDescription>
              </div>
              <Button asChild>
                <Link href={`/tool/organizations/${organizationId}/applicability-check/new`}>
                  <Plus />
                  {labels.assessment.newAssessment}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["draft", "in_review", "completed", "archived"].map((status) => (
                <div key={status} className="rounded-md border p-3">
                  <p className="text-2xl font-semibold">
                    {statusCounts[status] ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatStatus(status, labels.assessment.statuses)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{labels.assessment.listTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {labels.assessment.listDescription}
            </p>
          </div>
          <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            {initialAssessments.length} {labels.common.total}
          </span>
        </div>

        {initialAssessments.length === 0 ? (
          <Card className="rounded-lg border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{labels.assessment.emptyTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {labels.assessment.emptyDescription}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {initialAssessments.map((assessment) => (
              <Card key={assessment.id} className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{assessment.title}</CardTitle>
                  <CardDescription>
                    {labels.assessment.created} {formatDate(assessment.createdAt, locale, labels.common.withoutDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border px-2 py-1">
                    {formatStatus(assessment.status, labels.assessment.statuses)}
                  </span>
                  <span className="rounded-md border px-2 py-1">
                    {formatCategory(assessment.category)}
                  </span>
                  {assessment.completedAt && (
                    <span className="rounded-md border px-2 py-1">
                      {labels.assessment.completed} {formatDate(assessment.completedAt, locale, labels.common.withoutDate)}
                    </span>
                  )}
                  <Button asChild size="sm" variant="outline" className="ml-auto">
                    <Link
                      href={`/tool/organizations/${organizationId}/applicability-check/${assessment.id}`}
                    >
                      {labels.common.open}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatStatus(
  value: string,
  statuses: Dictionary["assessment"]["statuses"],
) {
  return statuses[value as keyof typeof statuses] ?? value.replaceAll("_", " ");
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}
