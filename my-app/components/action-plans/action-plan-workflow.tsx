"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  members,
}: {
  organizationId: string;
  current: CurrentPlan;
  canContribute: boolean;
  labels: Labels;
  members: Array<{
    userId: string;
    status: "active" | "removed" | "left";
  }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateItem(
    item: NonNullable<CurrentPlan>["items"][number],
    changes: {
      status: typeof item.status;
      ownerUserId: string | null;
      dueDate: string | null;
      executionNotes: string;
    },
  ) {
    setBusy(item.id);
    setError(null);
    try {
      await actionPlansClient.updateItem(
        organizationId,
        item.id,
        changes,
        item.version,
      );
      router.refresh();
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.error }));
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
        {current.items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {labels.empty}
            </CardContent>
          </Card>
        ) : (
          current.items.map((item) => (
            <ActionItem
              key={item.id}
              item={item}
              labels={labels}
              canContribute={canContribute}
              busy={busy === item.id}
              members={members}
              save={(changes) => updateItem(item, changes)}
            />
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
  members,
}: {
  item: NonNullable<CurrentPlan>["items"][number];
  labels: Labels;
  canContribute: boolean;
  busy: boolean;
  members: Array<{
    userId: string;
    status: "active" | "removed" | "left";
  }>;
  save: (changes: {
    status: typeof item.status;
    ownerUserId: string | null;
    dueDate: string | null;
    executionNotes: string;
  }) => Promise<void>;
}) {
  const [status, setStatus] = useState(item.status);
  const [ownerUserId, setOwnerUserId] = useState(item.ownerUserId ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [executionNotes, setExecutionNotes] = useState(
    item.executionNotes,
  );
  const deliverables = guidanceTexts(item.deliverables);
  const acceptanceCriteria = guidanceTexts(item.acceptanceCriteria);
  const suggestedEvidence = guidanceTexts(item.suggestedEvidence);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>
              {labels.measureTypes[item.measureType]}
            </CardDescription>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs">
            {labels.priorities[item.priority]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section aria-labelledby={`${item.id}-source`}>
          <h3
            id={`${item.id}-source`}
            className="text-sm font-semibold"
          >
            {labels.sourceRecommendation}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.sourceRecommendation}
          </p>
        </section>
        <GuidanceList
          id={`${item.id}-objective`}
          title={labels.objective}
          items={[item.objective]}
        />
        <GuidanceList
          id={`${item.id}-deliverables`}
          title={labels.deliverables}
          items={deliverables}
        />
        <GuidanceList
          id={`${item.id}-criteria`}
          title={labels.acceptanceCriteria}
          items={acceptanceCriteria}
        />
        <GuidanceList
          id={`${item.id}-evidence`}
          title={labels.suggestedEvidence}
          items={suggestedEvidence}
        />
        <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          {labels.status}
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as typeof status)
            }
            disabled={!canContribute}
          >
            {Object.entries(labels.statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {labels.owner}
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={ownerUserId}
            onChange={(event) => setOwnerUserId(event.target.value)}
            disabled={!canContribute}
          >
            <option value="">—</option>
            {members
              .filter((member) => member.status === "active")
              .map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userId}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {labels.dueDate}
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            disabled={!canContribute}
          />
        </label>
        </div>
        <label className="grid gap-1 text-sm">
          {labels.executionNotes}
          <Textarea
            value={executionNotes}
            onChange={(event) =>
              setExecutionNotes(event.target.value)
            }
            disabled={!canContribute}
            maxLength={20_000}
          />
        </label>
        {canContribute ? (
          <Button
            className="justify-self-start"
            disabled={busy}
            onClick={() =>
              save({
                status,
                ownerUserId: ownerUserId || null,
                dueDate: dueDate || null,
                executionNotes,
              })
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            {busy ? labels.saving : labels.save}
          </Button>
        ) : null}
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

function guidanceTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    typeof item === "object" &&
    item !== null &&
    typeof (item as { text?: unknown }).text === "string"
      ? [(item as { text: string }).text]
      : [],
  );
}
