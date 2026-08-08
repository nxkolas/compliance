"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CircleX,
  FileText,
  Loader2,
  LockKeyhole,
} from "lucide-react";
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
  const [resolvingFindingId, setResolvingFindingId] = useState<string | null>(
    null,
  );

  if (!workflow.revision) {
    return (
      <section className="grid gap-4">
        <h2 className="text-xl font-semibold">{labels.resultTitle}</h2>
        <p className="text-sm text-muted-foreground">{labels.noResult}</p>
      </section>
    );
  }

  const unresolvedContradictions = workflow.findings.filter(
    (row) =>
      row.finding.materialContradiction &&
      !row.finding.contradictionResolved,
  );
  const actionable = workflow.findings.filter(
    (row) => row.finding.status !== "fulfilled",
  );
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
        throw new Error(
          job.safeError?.message ?? labels.actionPlanGenerationFailed,
        );
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
        throw new Error(
          job.safeError?.message ?? labels.contradictionResolutionFailed,
        );
      }
      router.refresh();
    } catch (error) {
      onError(localizeGapError(error, labels));
    } finally {
      setResolvingFindingId(null);
    }
  }

  return (
    <section
      data-gap-results
      className="w-full max-w-[1202px] overflow-hidden rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] px-6 py-8 text-white shadow-sm sm:px-10 sm:py-10"
    >
      <div>
        <h2 className="text-2xl leading-8 font-bold">{labels.resultTitle}</h2>
        <p className="mt-2 text-base leading-7 text-white">
          {labels.stepDescriptions.gaps}
        </p>
      </div>

      {workflow.lifecycle.locked ? (
        <div
          data-gap-results-locked
          className="mt-6 flex h-16 w-full max-w-[1111px] items-center gap-4 rounded-xl bg-[#191F3C] px-6 text-base leading-7 shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] outline-[1.5px] outline-offset-[-1.5px] outline-[#122272]"
        >
          <LockKeyhole
            aria-hidden="true"
            className="size-5 shrink-0 text-[#002BFF]"
          />
          <p>{labels.lockedByActionPlan}</p>
        </div>
      ) : null}

      <section className="mt-8" aria-labelledby="gap-results-summary-heading">
        <h3
          id="gap-results-summary-heading"
          className="text-xl leading-7 font-bold"
        >
          {labels.statusSummary}
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_1.35fr_minmax(0,1fr)]">
          <FilterButton
            active={filter === "all"}
            label={labels.filterAll}
            count={counts.all}
            status="all"
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
              status={status}
              onClick={() => setFilter(status)}
            />
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6">
        {gaps.map((row) => (
          <article
            key={row.finding.id}
            data-gap-result-card
            className="overflow-hidden rounded-xl border-[1.5px] border-[#3D4049] bg-transparent shadow-sm"
          >
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl leading-7 font-bold break-words">
                    {row.requirement.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 font-medium tracking-wide text-white uppercase">
                    {labels.identifiedGaps}
                  </p>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-3">
                  <StatusBadge
                    label={labels.statuses[row.finding.status]}
                    status={row.finding.status}
                  />
                  <span className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border-[1.5px] border-[#3D4049] px-3 py-1 text-sm leading-5 text-white">
                    <DocumentStatusIcon
                      hasDocument={row.hasOrganizationDocument}
                    />
                    <span className="break-words">
                      {row.hasOrganizationDocument
                        ? labels.supportHasDocument
                        : labels.supportNoDocument}
                    </span>
                  </span>
                </div>
              </div>

              {row.finding.materialContradiction &&
              !row.finding.contradictionResolved ? (
                <>
                  <div
                    data-gap-contradiction
                    className="mt-6 flex min-h-24 w-full max-w-[1046px] items-start rounded-xl bg-zinc-800 px-5 py-4 shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] outline-[1.5px] outline-offset-[-1.5px] outline-red-400"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-red-400"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          {labels.reviewRequired}
                        </p>
                        {row.finding.reviewNotice ? (
                          <p className="mt-1 text-sm leading-6 text-white">
                            {row.finding.reviewNotice}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm leading-6 text-white">
                      {labels.contradictionDecision}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(resolvingFindingId)}
                        onClick={() =>
                          void resolveContradiction(
                            row.finding.id,
                            "questionnaire",
                          )
                        }
                      >
                        {resolvingFindingId === row.finding.id ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        {labels.trustQuestionnaire}
                      </Button>
                      <Button
                        size="sm"
                        disabled={Boolean(resolvingFindingId)}
                        onClick={() =>
                          void resolveContradiction(
                            row.finding.id,
                            "document",
                          )
                        }
                      >
                        {resolvingFindingId === row.finding.id ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        {labels.trustDocument}
                      </Button>
                    </div>
                    {resolvingFindingId === row.finding.id ? (
                      <p
                        className="mt-3 text-xs text-white/70"
                        aria-live="polite"
                      >
                        {labels.resolvingContradiction}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {row.finding.gaps.length ? (
                <ul className="mt-6 list-disc space-y-1.5 pl-5 text-base leading-7 text-white marker:text-white">
                  {row.finding.gaps.map((gap) => (
                    <li key={gap.id} className="pl-1 break-words">
                      {gap.statement}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <GapFindingSources sources={row.sources} labels={labels} />
          </article>
        ))}
        {!gaps.length ? (
          <p className="rounded-xl border-[1.5px] border-dashed border-[#3D4049] p-6 text-sm text-white/70">
            {labels.noFilterResults}
          </p>
        ) : null}
      </div>

      {workflow.lifecycle.canFinalize &&
      actionable.length &&
      workflow.canManage ? (
        <Button
          className="mt-6 h-12 bg-[#002BFF] px-6 text-white hover:bg-[#123BFF]"
          disabled={busy || Boolean(unresolvedContradictions.length)}
          onClick={generateActionPlan}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {labels.generateActionPlan}
        </Button>
      ) : null}
    </section>
  );
}

function FilterButton({
  label,
  count,
  active,
  status,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  status: Filter;
  onClick: () => void;
}) {
  const labelColor =
    status === "not_fulfilled"
      ? "text-red-400"
      : status === "partially_fulfilled"
        ? "text-amber-300"
        : status === "insufficient_evidence"
          ? "text-[#947998]"
          : status === "fulfilled"
            ? "text-emerald-500"
            : "text-white";

  return (
    <button
      type="button"
      aria-pressed={active}
      data-gap-status-filter={status}
      className={`min-h-28 rounded-xl border-[1.5px] p-4 text-left shadow-sm transition-colors ${
        active
          ? "border-[#002BFF] bg-[#202A46]"
          : "border-[#3D4049] bg-transparent hover:bg-white/[0.03]"
      }`}
      onClick={onClick}
    >
      <span className="block text-4xl leading-10 font-medium text-white">
        {count}
      </span>
      <span
        className={`mt-1 flex items-center gap-2 text-base leading-7 ${labelColor}`}
      >
        {status !== "all" ? <StatusIcon status={status} /> : null}
        <span>{label}</span>
      </span>
    </button>
  );
}

function StatusBadge({ label, status }: { label: string; status: GapStatus }) {
  const textColor =
    status === "not_fulfilled"
      ? "text-red-400"
      : status === "partially_fulfilled"
      ? "text-amber-300"
      : status === "insufficient_evidence"
        ? "text-[#947998]"
          : "text-emerald-500";

  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 rounded-lg border-[1.5px] border-[#3D4049] px-3 py-1 text-sm leading-5 ${textColor}`}
    >
      <StatusIcon status={status} />
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: GapStatus }) {
  if (status === "not_fulfilled") {
    return (
      <span className="relative size-5 shrink-0 overflow-hidden">
        <CircleX
          aria-hidden="true"
          className="absolute top-[1.67px] left-[1.67px] size-4 text-red-400"
          strokeWidth={1.33}
        />
      </span>
    );
  }
  if (status === "partially_fulfilled") {
    return <PartiallyFulfilledIcon />;
  }
  if (status === "insufficient_evidence") {
    return <InsufficientEvidenceIcon />;
  }
  return <FulfilledIcon />;
}

function DocumentStatusIcon({ hasDocument }: { hasDocument: boolean }) {
  if (hasDocument) {
    return (
      <FileText
        aria-hidden="true"
        className="h-[18px] w-4 shrink-0 text-white"
        strokeWidth={1.33}
      />
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-4 shrink-0"
      width="16"
      height="18"
      viewBox="0 0 16 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1.49837 17.3317H13.165C13.6071 17.3317 14.031 17.1561 14.3435 16.8435C14.6561 16.531 14.8317 16.1071 14.8317 15.665V4.83171L10.665 0.665039H3.16504C2.72301 0.665039 2.29909 0.840634 1.98653 1.15319C1.67397 1.46575 1.49837 1.88968 1.49837 2.33171V5.66504M9.83171 0.665039V3.99837C9.83171 4.4404 10.0073 4.86432 10.3199 5.17688C10.6324 5.48944 11.0563 5.66504 11.4984 5.66504H14.8317M4.83171 9.41504L0.665039 13.5817M0.665039 9.41504L4.83171 13.5817"
        stroke="white"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PartiallyFulfilledIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.0003 18.3332C14.6027 18.3332 18.3337 14.6022 18.3337 9.99984C18.3337 5.39746 14.6027 1.6665 10.0003 1.6665C5.39795 1.6665 1.66699 5.39746 1.66699 9.99984C1.66699 14.6022 5.39795 18.3332 10.0003 18.3332Z"
        stroke="#EAB446"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.0003 14.9998C11.3264 14.9998 12.5982 14.4731 13.5359 13.5354C14.4735 12.5977 15.0003 11.3259 15.0003 9.99984C15.0003 8.67375 14.4735 7.40199 13.5359 6.4643C12.5982 5.52662 11.3264 4.99984 10.0003 4.99984V14.9998Z"
        stroke="#EAB446"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InsufficientEvidenceIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.5752 7.4999C7.77112 6.94296 8.15782 6.47333 8.66682 6.17418C9.17583 5.87504 9.77427 5.76569 10.3562 5.8655C10.9381 5.96531 11.4659 6.26784 11.8461 6.71951C12.2263 7.17118 12.4344 7.74284 12.4335 8.33324C12.4335 9.9999 9.93353 10.8332 9.93353 10.8332M10.0003 14.1665H10.0087M18.3337 9.99984C18.3337 14.6022 14.6027 18.3332 10.0003 18.3332C5.39795 18.3332 1.66699 14.6022 1.66699 9.99984C1.66699 5.39746 5.39795 1.6665 10.0003 1.6665C14.6027 1.6665 18.3337 5.39746 18.3337 9.99984Z"
        stroke="#7E6181"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FulfilledIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18.1669 8.33357C18.5474 10.2013 18.2762 12.1431 17.3984 13.8351C16.5206 15.527 15.0893 16.8669 13.3431 17.6313C11.597 18.3957 9.64154 18.5384 7.80293 18.0355C5.96433 17.5327 4.35368 16.4147 3.23958 14.8681C2.12548 13.3214 1.57529 11.4396 1.68074 9.53639C1.78619 7.63318 2.54092 5.82364 3.81906 4.40954C5.0972 2.99545 6.8215 2.06226 8.7044 1.76561C10.5873 1.46897 12.515 1.82679 14.166 2.7794M7.49927 9.16691L9.99927 11.6669L18.3326 3.33358"
        stroke="#46A95A"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
