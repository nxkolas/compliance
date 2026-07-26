"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ListChecks,
  LockKeyhole,
  Loader2,
  Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { gapAnalysisClient } from "@/src/client/gap-analysis";
import { actionPlansClient } from "@/src/client/action-plans";
import { jobsClient } from "@/src/client/jobs";
import { ApiClientError } from "@/src/client/api-client";
import { formatDateTime } from "@/lib/i18n/format";
import {
  countGapStatuses,
  sortGapFindings,
  type GapStatus,
} from "@/src/server/gap-analysis/workflow-state";
import { localizeGapError } from "./gap-error";
import { GapFindingSources } from "./gap-finding-sources";
import type { GapLabels, GapLocale, GapWorkflow } from "./types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filter = "all" | GapStatus;

export function GapResultsStep({
  organizationId,
  workflow,
  labels,
  locale,
  onError,
}: {
  organizationId: string;
  workflow: GapWorkflow;
  labels: GapLabels;
  locale: GapLocale;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [overrides, setOverrides] = useState<Record<string, GapStatus>>({});
  const [manualOverrides, setManualOverrides] = useState<string[]>([]);
  const [showFinalization, setShowFinalization] = useState(false);
  const displayed = workflow.findings.map((row) => ({
    ...row,
    finding: {
      ...row.finding,
      status: overrides[row.finding.id] ?? row.finding.status,
    },
    manuallyChanged:
      row.manuallyChanged || manualOverrides.includes(row.finding.id),
  }));
  const counts = countGapStatuses(displayed);
  const gaps = sortGapFindings(displayed).filter(
    (row) =>
      filter === "all" || row.finding.status === filter,
  );

  async function finalizeAnalysis() {
    if (!workflow.revision) return;
    setBusy("finalize");
    onError(null);
    try {
      const started = await actionPlansClient.generate(organizationId, {
        gapRevisionId: workflow.revision.id,
      });
      setAnnouncement(labels.actionPlanGenerating);
      setShowFinalization(false);
      let job = started.data.job;
      while (
        job.state === "queued" ||
        job.state === "running" ||
        job.state === "cancellation_requested"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        job = (await jobsClient.get(job.id)).data.job;
      }
      if (job.state !== "succeeded" || !job.result?.actionPlanId) {
        throw new Error(
          job.safeError?.message ?? labels.actionPlanGenerationFailed,
        );
      }
      setAnnouncement(labels.actionPlanGenerated);
      router.push(`/tool/organizations/${organizationId}/action-plan`);
    } catch (error) {
      onError(localizeGapError(error, labels));
    } finally {
      setBusy(null);
    }
  }

  if (!workflow.revision) {
    return (
      <section aria-labelledby="gap-step-heading" className="grid gap-4">
        <h2
          id="gap-step-heading"
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {labels.resultTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{labels.noResult}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="gap-step-heading" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="gap-step-heading"
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {labels.resultTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.stepDescriptions.gaps}
          </p>
          {workflow.revision.outputLocale === "de" ||
          workflow.revision.outputLocale === "en" ? (
            <span className="mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs">
              {labels.resultLanguage}:{" "}
              {labels.resultLanguages[workflow.revision.outputLocale]}
            </span>
          ) : null}
          {workflow.lastWorkflowChange ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {labels.lastChanged}{" "}
              {formatDateTime(
                workflow.lastWorkflowChange.occurredAt,
                locale,
              )}{" "}
              {labels.by} {workflow.lastWorkflowChange.actor}
            </p>
          ) : null}
        </div>
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {workflow.lifecycle.locked ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/35 bg-primary/10 p-4 text-sm text-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{labels.lockedByActionPlan}</span>
        </div>
      ) : null}
      {workflow.staleness?.stale ? (
        <Notice>{labels.stale}</Notice>
      ) : null}
      {workflow.staleness?.outdatedRelease ? (
        <Notice>{labels.outdatedRelease}</Notice>
      ) : null}
      <div>
        <h3 className="mb-3 font-semibold">{labels.statusSummary}</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterButton
            active={filter === "all"}
            label={labels.filterAll}
            count={counts.all}
            onClick={() => setFilter("all")}
          />
          {(
            [
              "not_fulfilled",
              "partially_fulfilled",
              "insufficient_evidence",
              "fulfilled",
            ] as const
          ).map((status) => (
            <FilterButton
              key={status}
              active={filter === status}
              label={labels.statuses[status]}
              count={counts[status]}
              onClick={() => setFilter(status)}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        {gaps.map((row) => (
          <FindingCard
            key={row.finding.id}
            organizationId={organizationId}
            revisionId={workflow.revision!.id}
            row={row}
            labels={labels}
            locale={locale}
            canManage={
              workflow.canManage && workflow.lifecycle.findingsEditable
            }
            busy={busy}
            setBusy={setBusy}
            onSaved={(status, message) => {
              setOverrides((current) => ({
                ...current,
                [row.finding.id]: status,
              }));
              setManualOverrides((current) => [
                ...new Set([...current, row.finding.id]),
              ]);
              setAnnouncement(message ?? labels.assessmentSaved);
              onError(null);
              router.refresh();
            }}
            onError={onError}
          />
        ))}
        {gaps.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {labels.noFilterResults}
          </p>
        ) : null}
      </div>
      {workflow.lifecycle.canFinalize ? (
        <div className="grid gap-3">
          {workflow.canManage ? (
            <Button
              className="justify-self-start"
              disabled={
                Boolean(busy) || workflow.reviewBlockers.length > 0
              }
              onClick={() => setShowFinalization(true)}
            >
              {busy === "finalize" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ListChecks />
              )}
              {labels.generateActionPlan}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{labels.ownerOnly}</p>
          )}
        </div>
      ) : null}
      {workflow.lifecycle.locked ? (
        <Button asChild className="justify-self-start" variant="outline">
          <Link href={`/tool/organizations/${organizationId}/action-plan`}>
            {labels.openActionPlan}
          </Link>
        </Button>
      ) : null}
      <Dialog open={showFinalization} onOpenChange={setShowFinalization}>
        <DialogContent closeLabel={labels.cancelEdit}>
          <DialogHeader>
            <DialogTitle>{labels.finalizeTitle}</DialogTitle>
            <DialogDescription>
              {labels.finalizeDescription}
            </DialogDescription>
          </DialogHeader>
          <ul className="grid list-disc gap-2 pl-5 text-sm">
            <li>{labels.finalizeConfirms}</li>
            <li>{labels.finalizeCreatesPlan}</li>
            <li>{labels.finalizeFixedMeasures}</li>
            <li>{labels.finalizeLocks}</li>
          </ul>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={Boolean(busy)}>
                {labels.cancelEdit}
              </Button>
            </DialogClose>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void finalizeAnalysis()}
            >
              {busy === "finalize" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ListChecks />
              )}
              {labels.generateActionPlan}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FindingCard({
  organizationId,
  revisionId,
  row,
  labels,
  locale,
  canManage,
  busy,
  setBusy,
  onSaved,
  onError,
}: {
  organizationId: string;
  revisionId: string;
  row: GapWorkflow["findings"][number];
  labels: GapLabels;
  locale: GapLocale;
  canManage: boolean;
  busy: string | null;
  setBusy: (value: string | null) => void;
  onSaved: (status: GapStatus, message?: string) => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [status, setStatus] = useState<GapStatus>(row.finding.status);
  const [reason, setReason] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [regenerationReason, setRegenerationReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  useEffect(() => {
    setStatus(row.finding.status);
    setReason("");
    setResolutionReason("");
    setRegenerationReason("");
    setFieldError(null);
  }, [row.finding.id, row.finding.status]);

  async function regenerate() {
    if (!regenerationReason.trim()) {
      setFieldError(labels.errors.GAP_CORRECTION_REASON_REQUIRED);
      return;
    }
    setBusy(`regenerate-${row.finding.id}`);
    setFieldError(null);
    onError(null);
    try {
      await gapAnalysisClient.regenerateGuidance(
        organizationId,
        revisionId,
        {
          findingId: row.finding.id,
          reason: regenerationReason,
          retryNonce: crypto.randomUUID(),
        },
      );
      setRegenerating(false);
      onSaved(row.finding.status, labels.guidanceRegenerated);
    } catch (error) {
      onError(localizeGapError(error, labels));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!reason.trim()) {
      setFieldError(labels.errors.GAP_CORRECTION_REASON_REQUIRED);
      return;
    }
    if (row.finding.requiresReview && !resolutionReason.trim()) {
      setFieldError(labels.errors.GAP_REVIEW_RESOLUTION_REQUIRED);
      return;
    }
    setBusy(`correct-${row.finding.id}`);
    setFieldError(null);
    onError(null);
    try {
      await gapAnalysisClient.correctRevision(organizationId, revisionId, {
        corrections: [
          {
            findingId: row.finding.id,
            status,
            reason,
            ...(row.finding.requiresReview
              ? { requiresReview: false, resolutionReason }
              : {}),
          },
        ],
      });
      setEditing(false);
      onSaved(status);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.code === "GAP_CORRECTION_REASON_REQUIRED" ||
          error.code === "GAP_REVIEW_RESOLUTION_REQUIRED")
      ) {
        setFieldError(localizeGapError(error, labels));
      } else {
        onError(localizeGapError(error, labels));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">
            {localized(row.requirement.title, locale)}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{labels.statuses[row.finding.status]}</Badge>
            {row.hasOrganizationDocument ? (
              <Badge>{labels.supportHasDocument}</Badge>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                <AlertTriangle
                  className="h-3.5 w-3.5 text-primary"
                  aria-hidden="true"
                />
                {labels.supportNoDocument}
              </span>
            )}
            {row.manuallyChanged ? (
              <Badge>{labels.manuallyChanged}</Badge>
            ) : null}
          </div>
        </div>
        {canManage && !editing && !regenerating ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setEditing(true)}
            >
              <Pencil /> {labels.changeAssessment}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setRegenerating(true)}
            >
              {labels.regenerateGuidance}
            </Button>
          </div>
        ) : null}
      </div>
      {row.finding.requiresReview && row.finding.reviewNotice ? (
        <div className="mt-3 rounded-md border border-primary/35 bg-primary/10 p-3 text-sm text-foreground">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {labels.reviewRequired}
          </p>
          <p className="mt-1">{row.finding.reviewNotice}</p>
        </div>
      ) : null}
      <div className="mt-4 text-sm">
        {(row.finding.gaps ?? []).length ? (
          <ul className="list-disc space-y-1 pl-5">
            {(row.finding.gaps ?? []).map((gap) => (
              <li key={gap.id}>{gap.statement}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            {labels.noGapsIdentified}
          </p>
        )}
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            {labels.correctionRegenerates}
          </p>
          <label className="grid gap-1 text-sm font-medium">
            {labels.statusSummary}
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as GapStatus)
              }
            >
              {Object.entries(labels.statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {labels.correctionReason}
            <Textarea
              value={reason}
              aria-invalid={Boolean(fieldError)}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {row.finding.requiresReview ? (
            <label className="grid gap-1 text-sm font-medium">
              {labels.resolutionReason}
              <Textarea
                value={resolutionReason}
                aria-invalid={Boolean(fieldError)}
                onChange={(event) => setResolutionReason(event.target.value)}
              />
            </label>
          ) : null}
          {fieldError ? (
            <p className="text-sm text-destructive">{fieldError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={Boolean(busy)}
              onClick={() => void save()}
            >
              {busy === `correct-${row.finding.id}` ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {labels.saveCorrection}
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setEditing(false)}
            >
              {labels.cancelEdit}
            </Button>
          </div>
        </div>
      ) : regenerating ? (
        <div className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-4">
          <label className="grid gap-1 text-sm font-medium">
            {labels.regenerationReason}
            <Textarea
              value={regenerationReason}
              aria-invalid={Boolean(fieldError)}
              onChange={(event) =>
                setRegenerationReason(event.target.value)
              }
            />
          </label>
          {fieldError ? (
            <p className="text-sm text-destructive">{fieldError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={Boolean(busy)}
              onClick={() => void regenerate()}
            >
              {busy === `regenerate-${row.finding.id}` ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {labels.regenerateGuidance}
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setRegenerating(false)}
            >
              {labels.cancelEdit}
            </Button>
          </div>
        </div>
      ) : !canManage ? (
        <p className="mt-4 text-xs text-muted-foreground">{labels.readOnly}</p>
      ) : null}
      <GapFindingSources sources={row.sources} labels={labels} />
    </article>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-lg border p-4 text-left ${
        active ? "border-primary bg-primary/5" : ""
      }`}
      onClick={onClick}
    >
      <span className="block text-2xl font-semibold">{count}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </button>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border px-2.5 py-1 text-xs">{children}</span>
  );
}

function localized(value: unknown, locale: GapLocale) {
  if (typeof value === "string") return value;
  const candidate = value as { de?: unknown; en?: unknown };
  const localizedValue = candidate[locale] ?? candidate.de ?? candidate.en;
  return typeof localizedValue === "string" ? localizedValue : "";
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/60 p-4 text-sm text-foreground">
      {children}
    </div>
  );
}
