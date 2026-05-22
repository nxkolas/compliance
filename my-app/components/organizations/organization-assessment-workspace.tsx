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
import { ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type SerializedAssessment = SerializeDates<SelfCheckAssessmentDto>;

type OrganizationAssessmentWorkspaceProps = {
  organizationId: string;
  initialAssessments: SerializedAssessment[];
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
}: OrganizationAssessmentWorkspaceProps) {
  const [assessments] = useState(initialAssessments);

  const statusCounts = useMemo(
    () =>
      assessments.reduce<Record<string, number>>((counts, assessment) => {
        counts[assessment.status] = (counts[assessment.status] ?? 0) + 1;
        return counts;
      }, {}),
    [assessments],
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-6">
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Assessment overview</CardTitle>
                <CardDescription>
                  Current NIS2 applicability work for this organization.
                </CardDescription>
              </div>
              <Button asChild>
                <Link href={`/new/${organizationId}`}>
                  <Plus />
                  New assessment
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
                    {formatStatus(status)}
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
            <h2 className="text-xl font-semibold">NIS2 assessments</h2>
            <p className="text-sm text-muted-foreground">
              Review previous runs and continue from saved drafts.
            </p>
          </div>
          <span className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            {assessments.length} total
          </span>
        </div>

        {assessments.length === 0 ? (
          <Card className="rounded-lg border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No assessments yet</p>
                <p className="text-sm text-muted-foreground">
                  Create the first draft to begin NIS2 applicability work.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assessments.map((assessment) => (
              <Card key={assessment.id} className="rounded-lg shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{assessment.title}</CardTitle>
                  <CardDescription>
                    Created {formatDate(assessment.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border px-2 py-1">
                    {formatStatus(assessment.status)}
                  </span>
                  <span className="rounded-md border px-2 py-1">
                    {formatCategory(assessment.category)}
                  </span>
                  {assessment.completedAt && (
                    <span className="rounded-md border px-2 py-1">
                      Completed {formatDate(assessment.completedAt)}
                    </span>
                  )}
                  <Button asChild size="sm" variant="outline" className="ml-auto">
                    <Link href={`/assessments/${assessment.id}`}>
                      Open
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

function formatDate(value: string | null) {
  if (!value) {
    return "without date";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}
