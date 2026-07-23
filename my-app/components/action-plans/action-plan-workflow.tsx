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
import type { Dictionary } from "@/lib/i18n";
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
  members: Array<{ userId: string; status: "active" | "suspended" }>;
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
      setError(caught instanceof Error ? caught.message : labels.error);
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

  return (
    <div className="flex flex-col gap-6">
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
  members: Array<{ userId: string; status: "active" | "suspended" }>;
  save: (changes: {
    status: typeof item.status;
    ownerUserId: string | null;
    dueDate: string | null;
  }) => Promise<void>;
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
          <span className="rounded-full border px-3 py-1 text-xs">
            {labels.priorities[item.priority]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
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
        {canContribute ? (
          <Button
            className="md:col-span-3 md:justify-self-start"
            disabled={busy}
            onClick={() =>
              save({
                status,
                ownerUserId: ownerUserId || null,
                dueDate: dueDate || null,
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
