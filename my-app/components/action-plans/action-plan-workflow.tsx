"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import type { getActionPlanReconciliation } from "@/src/server/action-plans/reconciliation-service";
import type {
  getActionPlanHistory,
  getCurrentActionPlan,
} from "@/src/server/action-plans/service";
import { actionPlansClient } from "@/src/client/action-plans";

type CurrentPlan = Awaited<ReturnType<typeof getCurrentActionPlan>>;
type Reconciliation = Awaited<ReturnType<typeof getActionPlanReconciliation>>;
type History = Awaited<ReturnType<typeof getActionPlanHistory>>;
type Labels = Dictionary["modules"]["actionPlan"]["workflow"];

export function ActionPlanWorkflow({
  organizationId,
  current,
  approvedGapRevisionId,
  reconciliation,
  history,
  canManage,
  canContribute,
  labels,
  members,
}: {
  organizationId: string;
  current: CurrentPlan;
  approvedGapRevisionId: string | null;
  reconciliation: Reconciliation;
  history: History;
  canManage: boolean;
  canContribute: boolean;
  labels: Labels;
  members: Array<{ userId: string; status: "active" | "suspended" }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateAvailable = Boolean(
    current &&
      approvedGapRevisionId &&
      current.plan.sourceGapArtifactRevisionId !== approvedGapRevisionId,
  );
  const activeReconciliation =
    reconciliation &&
    reconciliation.reconciliation.targetGapRevisionId === approvedGapRevisionId &&
    ["draft", "ready"].includes(reconciliation.reconciliation.status)
      ? reconciliation
      : null;

  async function mutate(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      {!current ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.noPlan}</CardTitle>
            {!approvedGapRevisionId ? (
              <CardDescription>{labels.noApprovedRevision}</CardDescription>
            ) : null}
          </CardHeader>
          {approvedGapRevisionId && canManage ? (
            <CardContent>
              <Button
                disabled={busy !== null}
                onClick={() =>
                  mutate("generate", () => actionPlansClient.generate(organizationId, { approvedGapRevisionId }))
                }
              >
                {busy === "generate" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {busy === "generate" ? labels.generating : labels.generate}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          {current.sourceStaleness.stale ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {labels.staleSources}
            </div>
          ) : null}
          {updateAvailable ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              <span>{labels.updateAvailable}</span>
              {canManage && !activeReconciliation ? (
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    mutate("reconcile", () => actionPlansClient.prepareReconciliation(organizationId, { targetGapRevisionId: approvedGapRevisionId! }))
                  }
                >
                  {busy === "reconcile" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {labels.prepareUpdate}
                </Button>
              ) : null}
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
                  busy={busy}
                  members={members}
                  save={(changes) =>
                    mutate(`item-${item.id}`, () => actionPlansClient.updateItem(organizationId, item.id, changes, item.version))
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {activeReconciliation ? (
        <ReconciliationCard
          reconciliation={activeReconciliation}
          labels={labels}
          canManage={canManage}
          busy={busy}
          organizationId={organizationId}
          mutate={mutate}
        />
      ) : null}

      {history.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.history}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {history.map((entry) => (
              <details key={entry.plan.id} className="rounded-md border p-4">
                <summary className="cursor-pointer font-medium">
                  {labels.revision} {entry.plan.revisionNumber}
                </summary>
                <div className="mt-4 grid gap-3">
                  {entry.items.map((item) => (
                    <ActionItem
                      key={item.id}
                      item={item}
                      labels={labels}
                      canContribute={false}
                      busy={busy}
                      members={members}
                      save={async () => undefined}
                    />
                  ))}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ReconciliationCard({ reconciliation, labels, canManage, busy, organizationId, mutate }: {
  reconciliation: NonNullable<Reconciliation>;
  labels: Labels;
  canManage: boolean;
  busy: string | null;
  organizationId: string;
  mutate: (key: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.reconciliation}</CardTitle>
        <CardDescription>{reconciliation.ready ? labels.ready : labels.notReady}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {reconciliation.records.map((record) => (
          <ReconciliationItem
            key={record.id}
            record={record}
            labels={labels}
            canManage={canManage}
            busy={busy}
            save={(decision, reason) =>
              mutate(`decision-${record.id}`, () => actionPlansClient.decide(
                organizationId, record.id, { decision, reason }, reconciliation.reconciliation.version,
              ))
            }
          />
        ))}
        {canManage && reconciliation.ready ? (
          <Button
            className="self-start"
            disabled={busy !== null}
            onClick={() =>
              mutate("activate", () => actionPlansClient.activate(
                organizationId,
                { reconciliationId: reconciliation.reconciliation.id },
                reconciliation.reconciliation.version,
              ))
            }
          >
            {busy === "activate" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {labels.activate}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReconciliationItem({ record, labels, canManage, busy, save }: {
  record: NonNullable<Reconciliation>["records"][number];
  labels: Labels;
  canManage: boolean;
  busy: string | null;
  save: (decision: NonNullable<typeof record.proposedDecision>, reason: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState(
    record.decidedDecision ?? record.proposedDecision,
  );
  const [reason, setReason] = useState(record.reason ?? "");
  return (
    <article className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{record.targetItem?.title ?? record.previousItem?.title}</h3>
          <p className="text-sm text-muted-foreground">
            {record.targetItem?.description ?? record.previousItem?.description}
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs">
          {labels.changes[record.changeKind]}
        </span>
      </div>
      {record.targetEvidence.length ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">{labels.targetEvidence}</p>
          {record.targetEvidence.map((evidence) => (
            <blockquote key={evidence.id} className="mt-1 border-l-2 pl-3 text-muted-foreground">
              {evidence.excerpt}
            </blockquote>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm">
        {record.decidedDecision
          ? labels.decisions[record.decidedDecision]
          : record.proposedDecision
            ? labels.decisions[record.proposedDecision]
            : "—"}
      </p>
      {record.requiresDecision && canManage && decision ? (
        <div className="mt-4 grid gap-3 rounded-md bg-muted/30 p-3">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={decision}
            onChange={(event) =>
              setDecision(event.target.value as typeof decision)
            }
          >
            {record.allowedDecisions.map((value) => (
              <option key={value} value={value}>{labels.decisions[value]}</option>
            ))}
          </select>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={labels.decisionReason}
          />
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={busy !== null || !reason.trim()}
            onClick={() => save(decision, reason)}
          >
            {busy === `decision-${record.id}` ? <Loader2 className="animate-spin" /> : <Save />}
            {labels.decide}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function ActionItem({ item, labels, canContribute, busy, save, members }: {
  item: NonNullable<CurrentPlan>["items"][number];
  labels: Labels;
  canContribute: boolean;
  busy: string | null;
  members: Array<{ userId: string; status: "active" | "suspended" }>;
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
          <span className="rounded-full border px-3 py-1 text-xs">
            {labels.priorities[item.priority]}
          </span>
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
          <select className="h-10 rounded-md border bg-background px-3" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} disabled={!canContribute}>
            <option value="">—</option>
            {members.filter((member) => member.status === "active").map((member) => <option key={member.userId} value={member.userId}>{member.userId}</option>)}
          </select>
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
