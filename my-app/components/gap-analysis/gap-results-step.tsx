"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { gapAnalysisClient } from "@/src/client/gap-analysis";
import { ApiClientError } from "@/src/client/api-client";
import {
  countGapStatuses,
  sortGapFindings,
  type GapStatus,
  type GapWorkflowStep,
} from "@/src/server/gap-analysis/workflow-state";
import { GapHistory } from "./gap-history";
import { localizeGapError } from "./gap-error";
import type { GapLabels, GapLocale, GapWorkflow } from "./types";

type Filter = "all" | Exclude<GapStatus, "fulfilled">;

export function GapResultsStep({
  organizationId,
  workflow,
  labels,
  locale,
  onNavigate,
  onError,
}: {
  organizationId: string;
  workflow: GapWorkflow;
  labels: GapLabels;
  locale: GapLocale;
  onNavigate: (step: GapWorkflowStep) => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [overrides, setOverrides] = useState<Record<string, GapStatus>>({});
  const [manualOverrides, setManualOverrides] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
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
      row.finding.status !== "fulfilled" &&
      (filter === "all" || row.finding.status === filter),
  );
  const fulfilled = sortGapFindings(displayed).filter(
    (row) => row.finding.status === "fulfilled",
  );

  async function confirmResult() {
    if (!workflow.candidateRevision) return;
    setBusy("confirm");
    onError(null);
    try {
      await gapAnalysisClient.approveRevision(
        organizationId,
        workflow.candidateRevision.id,
      );
      setAnnouncement(labels.confirmed);
      router.refresh();
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
          {workflow.lastWorkflowChange ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {labels.lastChanged}{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(
                new Date(workflow.lastWorkflowChange.occurredAt),
              )}{" "}
              {labels.by} {workflow.lastWorkflowChange.actor}
            </p>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => onNavigate("questions")}>
          <RefreshCw /> {labels.updateAnalysis}
        </Button>
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {workflow.candidateRevision && workflow.acceptedRevision ? (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950">
          {labels.newResultBanner}
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
            canManage={workflow.canManage}
            busy={busy}
            setBusy={setBusy}
            onSaved={(status) => {
              setOverrides((current) => ({
                ...current,
                [row.finding.id]: status,
              }));
              setManualOverrides((current) => [
                ...new Set([...current, row.finding.id]),
              ]);
              setAnnouncement(labels.assessmentSaved);
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
      {fulfilled.length ? (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">
            {labels.fulfilledSection} ({fulfilled.length})
          </summary>
          <div className="mt-4 grid gap-3">
            {fulfilled.map((row) => (
              <FindingCard
                key={row.finding.id}
                organizationId={organizationId}
                revisionId={workflow.revision!.id}
                row={row}
                labels={labels}
                locale={locale}
                canManage={workflow.canManage}
                busy={busy}
                setBusy={setBusy}
                onSaved={(status) => {
                  setOverrides((current) => ({
                    ...current,
                    [row.finding.id]: status,
                  }));
                  setManualOverrides((current) => [
                    ...new Set([...current, row.finding.id]),
                  ]);
                  setAnnouncement(labels.assessmentSaved);
                  onError(null);
                  router.refresh();
                }}
                onError={onError}
              />
            ))}
          </div>
        </details>
      ) : null}
      {workflow.candidateRevision ? (
        <div className="grid gap-3">
          {workflow.canManage ? (
            <Button
              className="justify-self-start"
              disabled={
                Boolean(busy) || workflow.reviewBlockers.length > 0
              }
              onClick={() => void confirmResult()}
            >
              {busy === "confirm" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              {labels.confirmResult}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{labels.ownerOnly}</p>
          )}
        </div>
      ) : null}
      {workflow.acceptedRevision && workflow.candidateRevision ? (
        <div>
          <Button
            variant="outline"
            onClick={() => setShowComparison((current) => !current)}
          >
            {labels.compare} <ChevronRight />
          </Button>
          {showComparison ? (
            <Comparison workflow={workflow} labels={labels} locale={locale} />
          ) : null}
        </div>
      ) : null}
      {workflow.planUpdateAvailable ? (
        <Button asChild className="justify-self-start" variant="outline">
          <Link href={`/tool/organizations/${organizationId}/action-plan`}>
            {labels.updateActionPlan}
          </Link>
        </Button>
      ) : null}
      <GapHistory
        history={workflow.history}
        labels={labels}
        locale={locale}
      />
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
  onSaved: (status: GapStatus) => void;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<GapStatus>(row.finding.status);
  const [reason, setReason] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  useEffect(() => {
    setStatus(row.finding.status);
    setReason("");
    setResolutionReason("");
    setFieldError(null);
  }, [row.finding.id, row.finding.status]);

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
            <Badge>
              {row.hasOrganizationDocument
                ? labels.supportHasDocument
                : labels.supportNoDocument}
            </Badge>
            {row.manuallyChanged ? (
              <Badge>{labels.manuallyChanged}</Badge>
            ) : null}
          </div>
        </div>
        {canManage && !editing ? (
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => setEditing(true)}
          >
            <Pencil /> {labels.changeAssessment}
          </Button>
        ) : null}
      </div>
      {row.finding.requiresReview ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {labels.reviewRequired}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm">
        <Summary
          label={labels.rationale}
          value={localized(row.finding.rationale, locale)}
        />
        <Summary
          label={labels.recommendation}
          value={localized(row.finding.recommendation, locale)}
        />
      </dl>
      <details className="mt-4 rounded-md bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          {labels.showDetails}
        </summary>
        <div className="mt-3 grid gap-3">
          <Summary label="Code" value={row.requirement.code} />
          <div>
            <p className="font-medium">{labels.citations}</p>
            {row.evidence.length ? (
              <div className="mt-2 grid gap-2">
                {row.evidence.map((evidence) => (
                  <blockquote
                    key={evidence.id}
                    className="border-l-2 pl-3 text-muted-foreground"
                  >
                    {evidence.excerpt}
                    <span className="ml-2 text-xs">
                      [{evidence.citationId}]
                    </span>
                  </blockquote>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{labels.noCitations}</p>
            )}
          </div>
          {Array.isArray(row.finding.assumptions) &&
          row.finding.assumptions.length ? (
            <Summary
              label={labels.assumptions}
              value={row.finding.assumptions.join(" · ")}
            />
          ) : null}
          {row.contradictions.length ? (
            <Summary
              label={labels.contradictions}
              value={row.contradictions.join(" · ")}
            />
          ) : null}
        </div>
      </details>
      {editing ? (
        <div className="mt-4 grid gap-3 rounded-md border bg-muted/20 p-4">
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
            <p className="text-sm text-red-700">{fieldError}</p>
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
      ) : !canManage ? (
        <p className="mt-4 text-xs text-muted-foreground">{labels.readOnly}</p>
      ) : null}
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

function Comparison({
  workflow,
  labels,
  locale,
}: {
  workflow: GapWorkflow;
  labels: GapLabels;
  locale: GapLocale;
}) {
  const changes = workflow.comparison.filter((item) => item.changed);
  return (
    <div className="mt-4 rounded-lg border p-4">
      <h3 className="font-semibold">{labels.compareTitle}</h3>
      {changes.length ? (
        <div className="mt-3 grid gap-3">
          {changes.map((item) => (
            <div
              key={item.stableRequirementId}
              className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <p className="font-medium">{localized(item.title, locale)}</p>
              <Badge>
                {labels.previousStatus}:{" "}
                {item.previousStatus
                  ? labels.statuses[item.previousStatus]
                  : "—"}
              </Badge>
              <Badge>
                {labels.currentStatus}: {labels.statuses[item.currentStatus]}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.noChanges}
        </p>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border px-2.5 py-1 text-xs">{children}</span>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="text-muted-foreground">{value || "—"}</dd>
    </div>
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
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      {children}
    </div>
  );
}
