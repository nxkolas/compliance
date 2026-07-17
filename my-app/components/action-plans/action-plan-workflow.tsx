"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/lib/i18n";
import type { getCurrentActionPlan } from "@/src/server/action-plans/service";

type CurrentPlan = Awaited<ReturnType<typeof getCurrentActionPlan>>;
type Labels = Dictionary["modules"]["actionPlan"]["workflow"];

export function ActionPlanWorkflow({
  organizationId,
  current,
  approvedGapRevisionId,
  canManage,
  canContribute,
  labels,
}: {
  organizationId: string;
  current: CurrentPlan;
  approvedGapRevisionId: string | null;
  canManage: boolean;
  canContribute: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = `/api/organizations/${organizationId}/action-plan`;

  async function mutate(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(url, init);
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? labels.error);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}
      {!current ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.noPlan}</CardTitle>
            {!approvedGapRevisionId ? <CardDescription>{labels.noApprovedRevision}</CardDescription> : null}
          </CardHeader>
          {approvedGapRevisionId && canManage ? (
            <CardContent>
              <Button
                disabled={busy !== null}
                onClick={() => mutate("generate", baseUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ approvedGapRevisionId }),
                })}
              >
                {busy === "generate" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {busy === "generate" ? labels.generating : labels.generate}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          {current.plan.status === "stale" ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {labels.stale}
            </div>
          ) : null}
          <div className="grid gap-4">
            {current.items.length === 0 ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">{labels.empty}</CardContent></Card>
            ) : current.items.map((item) => (
              <ActionItem
                key={item.id}
                item={item}
                labels={labels}
                canContribute={canContribute}
                busy={busy}
                save={(changes) => mutate(`item-${item.id}`, `${baseUrl}/items/${item.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(changes),
                })}
              />
            ))}
          </div>
          {current.plan.status === "stale" && approvedGapRevisionId && canManage ? (
            <Button
              className="self-start"
              disabled={busy !== null}
              onClick={() => mutate("regenerate", baseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approvedGapRevisionId, regenerate: true }),
              })}
            >
              {busy === "regenerate" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {labels.regenerate}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function ActionItem({ item, labels, canContribute, busy, save }: {
  item: NonNullable<CurrentPlan>["items"][number];
  labels: Labels;
  canContribute: boolean;
  busy: string | null;
  save: (changes: { status: typeof item.status; ownerUserId: string | null; dueDate: string | null }) => Promise<void>;
}) {
  const [status, setStatus] = useState(item.status);
  const [ownerUserId, setOwnerUserId] = useState(item.ownerUserId ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs">{labels.priorities[item.priority]}</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          {labels.status}
          <select className="h-10 rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} disabled={!canContribute}>
            {Object.entries(labels.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {labels.owner}
          <Input value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} disabled={!canContribute} />
        </label>
        <label className="grid gap-1 text-sm">
          {labels.dueDate}
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={!canContribute} />
        </label>
        {canContribute ? (
          <Button className="md:col-span-3 md:justify-self-start" disabled={busy !== null} onClick={() => save({ status, ownerUserId: ownerUserId || null, dueDate: dueDate || null })}>
            {busy === `item-${item.id}` ? <Loader2 className="animate-spin" /> : <Save />}
            {busy === `item-${item.id}` ? labels.saving : labels.save}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
