"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clock3,
  Download,
  FilePlus2,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { Dictionary, Locale } from "@/src/i18n";
import { localizeUiError } from "@/src/i18n/errors";
import { formatDateTime, formatNumber } from "@/src/i18n/format";
import { jobsClient } from "@/src/client/jobs";
import { pollJob } from "@/src/client/job-polling";
import { reportsClient } from "@/src/client/reports";
import type { listReports } from "@/src/server/modules/reports/report-library";

type ReportWorkflowProps = {
  organizationId: string;
  locale: Locale;
  reports: Awaited<ReturnType<typeof listReports>>;
  canCreate: boolean;
  labels: Dictionary["reports"]["workflow"];
};

type ReportState = ReportWorkflowProps["reports"][number]["state"];

export function ReportWorkflow({
  organizationId,
  locale,
  reports,
  canCreate,
  labels,
}: ReportWorkflowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeJobIds = useMemo(
    () =>
      reports
        .filter((report) => ["queued", "rendering"].includes(report.state))
        .map((report) => report.renderingJobId),
    [reports],
  );

  useEffect(() => {
    if (!activeJobIds.length) return;

    const controller = new AbortController();
    for (const jobId of activeJobIds) {
      void pollJob({
        jobId,
        signal: controller.signal,
        finalRefresh: () => router.refresh(),
      }).catch((caught) => {
        if (!controller.signal.aborted) {
          setError(localizeUiError(caught, { fallback: labels.error }));
        }
      });
    }
    return () => controller.abort();
  }, [activeJobIds, labels.error, router]);

  async function act(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(localizeUiError(caught, { fallback: labels.error }));
    } finally {
      setBusy(null);
    }
  }

  function createReport(key = "create") {
    return act(key, () => reportsClient.create(organizationId, { locale }));
  }

  return (
    <div
      className="grid w-full min-w-0 gap-4 sm:gap-6"
      data-report-workflow
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="text-current">{error}</AlertDescription>
        </Alert>
      ) : null}

      {canCreate ? (
        <div className="flex w-full justify-end" data-report-create-action>
          <Button
            className="h-12 w-full gap-[11px] rounded-lg px-[15px] text-base font-medium shadow-none sm:w-48"
            disabled={busy !== null}
            onClick={() => createReport()}
          >
            {busy === "create" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FilePlus2 />
            )}
            {labels.create}
          </Button>
        </div>
      ) : null}

      {reports.length ? (
        <div className="grid gap-4" data-report-list>
          {reports.map((report) => {
            const isReady = report.state === "ready";
            const isFailed =
              report.state === "failed" || report.state === "cancelled";
            const isProcessing = ["queued", "rendering"].includes(
              report.state,
            );

            return (
              <Card
                key={report.id}
                data-report-state={report.state}
                className={`w-full min-w-0 gap-0 rounded-xl border-[1.5px] border-[#3D4049] bg-[#1B1E27] py-0 text-white shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] ${isReady ? "min-h-48" : "min-h-40"}`}
              >
                <CardContent className="grid min-w-0 grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:px-6">
                  <div className="min-w-0">
                    <div className="flex min-h-8 flex-wrap items-center gap-x-6 gap-y-2">
                      <CardTitle className="min-w-0 break-words text-base leading-5 font-semibold">
                        {labels.title}
                      </CardTitle>
                      <ReportStatus
                        state={report.state}
                        label={labels.statuses[report.state]}
                      />
                    </div>
                    <p className="text-xs leading-5 text-zinc-500">
                      {formatDateTime(report.createdAt, locale)}
                    </p>
                    {isFailed ? (
                      <p className="mt-4 break-words text-base leading-6 text-red-400">
                        {report.state === "failed"
                          ? labels.failedDescription
                          : labels.statuses.cancelled}
                      </p>
                    ) : null}
                    {isProcessing ? (
                      <p className="mt-4 text-base leading-6 text-zinc-400" role="status">
                        {labels.statuses[report.state]}
                      </p>
                    ) : null}
                    {isReady ? (
                      <ul className="mt-4 space-y-1 text-sm leading-5 text-zinc-300" data-report-contents>
                        {(report.metrics ? [
                          {
                            text: labels.compliance.replace("{percent}", formatNumber(report.metrics.compliancePercent, locale)),
                            explanation: labels.complianceExplanation,
                          },
                          {
                            text: report.metrics.criticalGapCount === 1
                              ? labels.criticalGapOne
                              : labels.criticalGapMany.replace("{count}", formatNumber(report.metrics.criticalGapCount, locale)),
                            explanation: labels.criticalGapExplanation,
                          },
                        ] : [
                          { text: labels.includesApplicability, explanation: undefined },
                          ...(report.gapRevisionId ? [{ text: labels.metricsUnavailable, explanation: undefined }] : []),
                          ...(report.actionPlanId ? [{ text: labels.includesActionPlan, explanation: undefined }] : []),
                        ]).map((item) => (
                          <li key={item.text} title={item.explanation} className="flex items-start gap-2">
                            <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#002BFF]" />
                            <span className="min-w-0 break-words">{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {report.inputHash ? (
                      <p className="mt-3 break-all text-xs leading-5 text-zinc-500">
                        {labels.sourceHash}: {report.inputHash.slice(0, 12)}
                      </p>
                    ) : null}
                  </div>

                  {isReady || (canCreate && (isProcessing || isFailed)) ? (
                    <div className="flex min-w-0 w-full flex-col gap-2 sm:mt-2 sm:w-auto sm:flex-row sm:items-center">
                      {isReady ? (
                        <Button
                          variant="outline"
                          className="h-12 w-full cursor-pointer rounded-lg border-[1.5px] border-[#3D4049] bg-transparent px-4 text-base font-medium text-zinc-300 shadow-none hover:bg-white/5 hover:text-white disabled:cursor-not-allowed sm:w-44 dark:border-[#3D4049] dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-zinc-400"
                          disabled={busy === `download-${report.id}`}
                          onClick={() =>
                            act(`download-${report.id}`, async () => {
                              const result = await reportsClient.download(
                                organizationId,
                                report.id,
                              );
                              window.location.assign(
                                result.data.download.url,
                              );
                            })
                          }
                        >
                          {busy === `download-${report.id}` ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Download />
                          )}
                          {labels.download}
                        </Button>
                      ) : null}
                      {isFailed && canCreate ? (
                        <Button
                          variant="outline"
                          className="h-12 w-full cursor-pointer rounded-lg border-[1.5px] border-[#3D4049] bg-transparent px-4 text-base font-medium text-zinc-300 shadow-none hover:bg-white/5 hover:text-white disabled:cursor-not-allowed sm:w-52 dark:border-[#3D4049] dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-zinc-400"
                          disabled={busy !== null}
                          onClick={() => createReport(`retry-${report.id}`)}
                        >
                          {busy === `retry-${report.id}` ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <RotateCcw />
                          )}
                          {labels.retry}
                        </Button>
                      ) : null}
                      {isProcessing && canCreate ? (
                        <Button
                          variant="outline"
                          className="h-12 w-full cursor-pointer rounded-lg border-[1.5px] border-[#3D4049] bg-transparent px-4 text-base font-medium text-zinc-300 shadow-none hover:bg-white/5 hover:text-white disabled:cursor-not-allowed sm:w-auto dark:border-[#3D4049] dark:bg-transparent dark:hover:bg-white/5 [&_svg]:text-zinc-400"
                          disabled={busy === `cancel-${report.id}`}
                          onClick={() =>
                            act(`cancel-${report.id}`, () =>
                              jobsClient.cancel(report.renderingJobId),
                            )
                          }
                        >
                          {busy === `cancel-${report.id}` ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <XCircle />
                          )}
                          {labels.cancel}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card
          className="h-auto min-h-[320px] gap-0 rounded-xl border-0 bg-card py-0 shadow-[0px_1px_2px_-1px_rgba(0,0,0,0.10),0px_1px_3px_0px_rgba(0,0,0,0.10)] outline-[1.5px] outline-offset-[-1.5px] outline-border-strong sm:min-h-[344px] xl:min-h-96"
          data-report-empty-state
        >
          <CardContent className="flex min-h-[320px] flex-col items-center px-4 py-10 text-center sm:min-h-[344px] sm:px-8 xl:min-h-96 xl:pt-[57px] xl:pb-[52px]">
            <ReportEmptyIcon />
            <h2 className="mt-8 text-lg leading-6 font-medium text-foreground xl:mt-[59px] xl:leading-4">
              {labels.emptyTitle}
            </h2>
            <p className="mt-5 max-w-[648px] text-sm leading-6 text-foreground sm:text-base xl:mt-10">
              {labels.emptyDescription}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportEmptyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[109px] w-[87px] shrink-0"
      data-report-empty-icon
      fill="none"
      viewBox="0 0 87 109"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        clipRule="evenodd"
        d="M76.0696 0.131829C82.0558 0.144003 86.8984 5.00649 86.8862 10.9925L86.776 65.1856L51.5504 65.114C47.0611 65.1049 43.4141 68.7371 43.4049 73.2264L43.3333 108.452L10.8174 108.386C4.83142 108.374 -0.0113278 103.511 0.000845656 97.5252L0.177177 10.8162C0.18935 4.83015 5.05183 -0.0125926 11.0378 -0.000419482L76.0696 0.131829ZM86.5187 76.0238C86.0838 78.06 85.0665 79.945 83.5683 81.4371L59.5977 105.31C58.0995 106.803 56.2104 107.812 54.1724 108.239L54.2381 75.9581L86.5187 76.0238ZM32.6159 48.8175L27.1966 48.8065C24.2036 48.8004 21.7723 51.2217 21.7663 54.2147C21.7602 57.2078 24.1816 59.639 27.1746 59.6451L32.5939 59.6561C35.587 59.6622 38.0181 57.2409 38.0242 54.2478C38.0303 51.2547 35.609 48.8236 32.6159 48.8175ZM59.7566 27.1953L27.2407 27.1292C24.2477 27.1231 21.8164 29.5445 21.8103 32.5375C21.8043 35.5305 24.2257 37.9617 27.2186 37.9678L59.7345 38.034C62.7276 38.04 65.1588 35.6187 65.1648 32.6257C65.1709 29.6327 62.7496 27.2014 59.7566 27.1953Z"
        fill="#82848C"
        fillRule="evenodd"
      />
    </svg>
  );
}

function ReportStatus({ state, label }: { state: ReportState; label: string }) {
  const isReady = state === "ready";
  const isFailed = state === "failed" || state === "cancelled";
  const Icon = isReady ? Check : isFailed ? AlertTriangle : Clock3;
  const className = isReady
    ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
    : isFailed
      ? "border-red-400 bg-zinc-800 text-red-400"
      : "border-blue-400 bg-blue-400/10 text-blue-400";

  return (
    <span
      className={`inline-flex min-h-8 w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1 text-base leading-5 ${className}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </span>
  );
}
