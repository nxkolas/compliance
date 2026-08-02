"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actionPlansClient } from "@/src/client/action-plans";
import { gapAnalysisClient } from "@/src/client/gap-analysis";
import { pollJob } from "@/src/client/job-polling";
import {
  countGapStatuses,
  sortGapFindings,
  type GapStatus,
} from "@/src/server/gap-analysis/workflow-state";
import { localizeGapError } from "./gap-error";
import { GapCategoryIcon } from "./gap-category-icon";
import { GapFindingSources } from "./gap-finding-sources";
import type { GapLabels, GapLocale, GapWorkflow } from "./types";

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
  void locale;
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [resolvingFindingId, setResolvingFindingId] = useState<string | null>(null);
  if (!workflow.revision) {
    return (
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{labels.resultTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.noResult}</p>
      </section>
    );
  }
  const unresolvedContradictions = workflow.findings.filter(
    (row) => row.finding.materialContradiction && !row.finding.contradictionResolved,
  );
  const actionable = workflow.findings.filter((row) => row.finding.status !== "fulfilled");
  const counts = countGapStatuses(workflow.findings);
  const gaps = sortGapFindings(workflow.findings).filter(
    (row) => filter === "all" || row.finding.status === filter,
  );

  async function generateActionPlan() {
    if (!workflow.revision || unresolvedContradictions.length) return;
    setBusy(true);
    onError(null);
    try {
      const started = await actionPlansClient.generate(organizationId, {
        gapRevisionId: workflow.revision.id,
      });
      const job = await pollJob({
        jobId: started.data.job.id,
        signal: new AbortController().signal,
        finalRefresh: () => undefined,
      });
      if (job.state !== "succeeded" || !job.result?.actionPlanId) {
        throw new Error(job.safeError?.message ?? labels.actionPlanGenerationFailed);
      }
      router.push(`/tool/organizations/${organizationId}/action-plan`);
    } catch (error) {
      onError(localizeGapError(error, labels));
    } finally {
      setBusy(false);
    }
  }

  async function resolveContradiction(
    findingId: string,
    sourceChoice: "questionnaire" | "document",
  ) {
    if (!workflow.revision) return;
    setResolvingFindingId(findingId);
    onError(null);
    try {
      const started = await gapAnalysisClient.resolveContradiction(
        organizationId,
        workflow.revision.id,
        findingId,
        sourceChoice,
      );
      const job = await pollJob({
        jobId: started.data.job.id,
        signal: new AbortController().signal,
        finalRefresh: () => undefined,
      });
      if (job.state !== "succeeded") {
        throw new Error(job.safeError?.message ?? labels.contradictionResolutionFailed);
      }
      router.refresh();
    } catch (error) {
      onError(localizeGapError(error, labels));
    } finally {
      setResolvingFindingId(null);
    }
  }

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">{labels.resultTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {labels.stepDescriptions.gaps}
        </p>
      </div>
      {unresolvedContradictions.length ? (
        <div className="flex gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{labels.reviewRequired}</p>
        </div>
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
          {(["not_fulfilled", "partially_fulfilled", "insufficient_evidence", "fulfilled"] as const).map((status) => (
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
          <article key={row.finding.id} className="rounded-lg border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <GapCategoryIcon name={row.requirement.icon} />
              <h3 className="font-semibold">{row.requirement.title}</h3>
              <span className="ml-auto rounded-full border px-2 py-0.5 text-xs">
                {labels.statuses[row.finding.status]}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs">
                {row.hasOrganizationDocument
                  ? labels.supportHasDocument
                  : labels.supportNoDocument}
              </span>
            </div>
            {row.finding.materialContradiction && !row.finding.contradictionResolved ? (
              <div className="mt-4 grid gap-3 rounded-md border border-warning/50 bg-warning/10 p-4">
                {row.finding.reviewNotice ? (
                  <p className="text-sm">{row.finding.reviewNotice}</p>
                ) : null}
                <p className="text-sm">{labels.contradictionDecision}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(resolvingFindingId)}
                    onClick={() => void resolveContradiction(row.finding.id, "questionnaire")}
                  >
                    {resolvingFindingId === row.finding.id ? <Loader2 className="animate-spin" /> : null}
                    {labels.trustQuestionnaire}
                  </Button>
                  <Button
                    size="sm"
                    disabled={Boolean(resolvingFindingId)}
                    onClick={() => void resolveContradiction(row.finding.id, "document")}
                  >
                    {resolvingFindingId === row.finding.id ? <Loader2 className="animate-spin" /> : null}
                    {labels.trustDocument}
                  </Button>
                </div>
                {resolvingFindingId === row.finding.id ? (
                  <p className="text-xs text-muted-foreground" aria-live="polite">{labels.resolvingContradiction}</p>
                ) : null}
              </div>
            ) : null}
            {row.finding.gaps.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {row.finding.gaps.map((gap) => <li key={gap.id}>{gap.statement}</li>)}
              </ul>
            ) : null}
            <GapFindingSources sources={row.sources} labels={labels} />
          </article>
        ))}
        {!gaps.length ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {labels.noFilterResults}
          </p>
        ) : null}
      </div>
      {workflow.lifecycle.canFinalize && actionable.length && workflow.canManage ? (
        <Button className="justify-self-start" disabled={busy || Boolean(unresolvedContradictions.length)} onClick={generateActionPlan}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {labels.generateActionPlan}
        </Button>
      ) : null}
    </section>
  );
}

function FilterButton({ label, count, active, onClick }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-lg border p-4 text-left ${active ? "border-primary bg-primary/5" : ""}`}
      onClick={onClick}
    >
      <span className="block text-2xl font-semibold">{count}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </button>
  );
}
