"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import type { getCurrentActionPlan } from "@/src/server/action-plans/service";
import { actionPlansClient } from "@/src/client/action-plans";

type CurrentPlan = Awaited<ReturnType<typeof getCurrentActionPlan>>;
type Labels = Dictionary["modules"]["actionPlan"]["workflow"];

export function ActionPlanWorkflow({ organizationId, current, canContribute, labels }: {
  organizationId: string;
  current: CurrentPlan;
  canContribute: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!current) {
    return (
      <Card>
        <CardHeader><CardTitle>{labels.noPlan}</CardTitle><CardDescription>{labels.noApprovedRevision}</CardDescription></CardHeader>
        <CardContent><Button asChild><Link href={`/tool/organizations/${organizationId}/gap-analysis`}>{labels.openGapAnalysis}</Link></Button></CardContent>
      </Card>
    );
  }
  async function update(itemId: string, status: "open" | "in_progress" | "done") {
    setBusy(itemId);
    setError(null);
    try {
      await actionPlansClient.updateItem(organizationId, itemId, { status });
      router.refresh();
      return true;
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.error }));
      return false;
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="inline-flex rounded-full border px-3 py-1 text-xs">
          {labels.resultLanguage}: {labels.resultLanguages[current.plan.locale === "de" ? "de" : "en"]}
        </span>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription className="text-current">{error}</AlertDescription></Alert> : null}
      {current.sourceStaleness.stale ? <Alert variant="warning"><AlertDescription className="text-current">{labels.staleSources}</AlertDescription></Alert> : null}
      <div className="grid gap-4">
        {!current.categories.length ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">{labels.empty}</CardContent></Card>
        ) : current.categories.map((category) => (
          <section key={category.requirementVersionId} className="grid gap-3">
            <h2 className="text-lg font-semibold">{category.title}</h2>
            {category.actions.map((item) => (
              <ActionItem
                key={item.id}
                item={item}
                labels={labels}
                canContribute={canContribute}
                busy={busy === item.id}
                save={(status) => update(item.id, status)}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function ActionItem({ item, labels, canContribute, busy, save }: {
  item: NonNullable<CurrentPlan>["categories"][number]["actions"][number];
  labels: Labels;
  canContribute: boolean;
  busy: boolean;
  save: (status: "open" | "in_progress" | "done") => Promise<boolean>;
}) {
  const [status, setStatus] = useState(item.status);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>{item.title}</CardTitle>
          <span className="rounded-full border px-3 py-1 text-xs">
            {labels.priorities[item.priority]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section aria-labelledby={`${item.id}-result`}>
          <h3 id={`${item.id}-result`} className="text-sm font-semibold">{labels.result}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{item.result}</p>
        </section>
        <GuidanceList id={`${item.id}-evidence`} title={labels.recommendedEvidence} items={item.suggestedEvidence} />
        <label className="grid max-w-xs gap-1 text-sm">
          {labels.status}
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={status}
            disabled={!canContribute || busy}
            onChange={(event) => {
              const previous = status;
              const next = event.target.value as typeof status;
              setStatus(next);
              void save(next).then((saved) => {
                if (!saved) setStatus(previous);
              });
            }}
          >
            {(["open", "in_progress", "done"] as const).map((value) => <option key={value} value={value}>{labels.statuses[value]}</option>)}
          </select>
        </label>
      </CardContent>
    </Card>
  );
}

function GuidanceList({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
      </ul>
    </section>
  );
}
