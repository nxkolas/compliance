"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import type { getCurrentActionPlan } from "@/src/server/action-plans/service";
import { actionPlansClient } from "@/src/client/action-plans";

type CurrentPlan = Awaited<ReturnType<typeof getCurrentActionPlan>>;
type Labels = Dictionary["modules"]["actionPlan"]["workflow"];

export function ActionPlanWorkflow({
  organizationId,
  current,
  canContribute,
  labels,
}: {
  organizationId: string;
  current: CurrentPlan;
  canContribute: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateItem(
    item: NonNullable<CurrentPlan>["categories"][number]["actions"][number],
    status: typeof item.status,
    expectedVersion: number,
  ) {
    setBusy(item.id);
    setError(null);
    try {
      const result = await actionPlansClient.updateItem(
        organizationId,
        item.id,
        { status },
        expectedVersion,
      );
      return result.data.item.version;
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.error }));
      router.refresh();
      return null;
    } finally {
      setBusy(null);
    }
  }

  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.noPlan}</CardTitle>
          <CardDescription>{labels.noApprovedRevision}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/tool/organizations/${organizationId}/gap-analysis`}>
              {labels.openGapAnalysis}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const resultLocale =
    current.plan.outputLocale === "de" ? "de" : "en";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="inline-flex rounded-full border px-3 py-1 text-xs">
          {labels.resultLanguage}:{" "}
          {labels.resultLanguages[resultLocale]}
        </span>
      </div>
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      {current.sourceStaleness.stale ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {labels.staleSources}
        </div>
      ) : null}
      <div className="grid gap-4">
        {current.categories.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {labels.empty}
            </CardContent>
          </Card>
        ) : (
          current.categories.map((category) => (
            <section key={category.requirementVersionId} className="grid gap-3">
              <h2 className="text-lg font-semibold">{category.title}</h2>
              {category.actions.map((item) => (
                <ActionItem
                  key={`${item.id}:${item.version}`}
                  item={item}
                  labels={labels}
                  canContribute={canContribute}
                  busy={busy === item.id}
                  save={(status, expectedVersion) =>
                    updateItem(item, status, expectedVersion)
                  }
                />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function ActionItem({
  item,
  labels,
  canContribute,
  busy,
  save,
}: {
  item: NonNullable<CurrentPlan>["categories"][number]["actions"][number];
  labels: Labels;
  canContribute: boolean;
  busy: boolean;
  save: (
    status: typeof item.status,
    expectedVersion: number,
  ) => Promise<number | null>;
}) {
  const [status, setStatus] = useState(item.status);
  const versionRef = useRef(item.version);
  const suggestedEvidence = stringArray(item.suggestedEvidence);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.title}</CardTitle>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs">
            {labels.priorities[item.priority]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section aria-labelledby={`${item.id}-result`}>
          <h3
            id={`${item.id}-result`}
            className="text-sm font-semibold"
          >
            {labels.result}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.result}
          </p>
        </section>
        <GuidanceList
          id={`${item.id}-evidence`}
          title={labels.recommendedEvidence}
          items={suggestedEvidence}
        />
        <label className="grid max-w-xs gap-1 text-sm">
          {labels.status}
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={status}
            onChange={(event) => {
              if (busy) return;
              const previousStatus = status;
              const nextStatus = event.target.value as typeof status;
              setStatus(nextStatus);
              void save(nextStatus, versionRef.current).then(
                (updatedVersion) => {
                  if (updatedVersion === null) {
                    setStatus(previousStatus);
                    return;
                  }
                  versionRef.current = updatedVersion;
                },
              );
            }}
            disabled={!canContribute || busy}
          >
            {Object.entries(labels.statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

        </label>
      </CardContent>
    </Card>
  );
}

function GuidanceList({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: string[];
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={`${index}:${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
