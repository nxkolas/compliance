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
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.error }));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid gap-6">
      <span className="w-fit rounded-full border px-3 py-1 text-xs">
        {labels.resultLanguage}: {labels.resultLanguages[current.plan.locale as "de" | "en"]}
      </span>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {current.sourceStaleness.stale ? <Alert variant="warning"><AlertDescription>{labels.staleSources}</AlertDescription></Alert> : null}
      {current.categories.map((category) => (
        <section key={category.requirementVersionId} className="grid gap-3">
          <h2 className="text-lg font-semibold">{category.title}</h2>
          {category.actions.map((item) => (
            <Card key={item.id}>
              <CardHeader><CardTitle>{item.title}</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <label className="grid max-w-xs gap-1 text-sm">
                  {labels.status}
                  <select
                    className="h-10 rounded-md border bg-background px-3"
                    value={item.status}
                    disabled={!canContribute || busy === item.id}
                    onChange={(event) => void update(item.id, event.target.value as "open" | "in_progress" | "done")}
                  >
                    {(["open", "in_progress", "done"] as const).map((status) => <option key={status} value={status}>{labels.statuses[status]}</option>)}
                  </select>
                </label>
              </CardContent>
            </Card>
          ))}
        </section>
      ))}
      {!current.categories.length ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : null}
    </div>
  );
}
