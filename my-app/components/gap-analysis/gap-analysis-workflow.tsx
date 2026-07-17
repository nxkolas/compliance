"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import type { Dictionary, Locale } from "@/lib/i18n";

type Workflow = Awaited<ReturnType<typeof getGapAnalysisWorkflow>>;
type Labels = Dictionary["modules"]["gapAnalysis"]["workflow"];

export function GapAnalysisWorkflow({
  organizationId,
  workflow,
  labels,
  locale,
}: {
  organizationId: string;
  workflow: Workflow;
  labels: Labels;
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(workflow.answers);
  const indexedVersions = useMemo(
    () => workflow.documents.flatMap((row) =>
      row.document.status === "active" &&
      row.version &&
      row.embedding?.status === "succeeded"
        ? [row.version.id]
        : [],
    ),
    [workflow.documents],
  );
  const [selectedVersions, setSelectedVersions] = useState<string[]>(indexedVersions);
  const baseUrl = `/api/organizations/${organizationId}/gap-analysis`;

  async function mutate(key: string, url: string, init: RequestInit = {}) {
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

  if (!workflow.release) {
    return <Notice tone="warning">{labels.unavailable}</Notice>;
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!workflow.assessment ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.prerequisiteTitle}</CardTitle>
            <CardDescription>{labels.prerequisite}</CardDescription>
          </CardHeader>
          <CardContent>
            {workflow.canContribute ? (
              <Button
                disabled={busy !== null}
                onClick={() => mutate("create", `${baseUrl}/assessments`, { method: "POST" })}
              >
                {busy === "create" ? <Loader2 className="animate-spin" /> : <Play />}
                {labels.create}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{labels.questionnaire}</CardTitle>
              <CardDescription>{workflow.release.versionLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void mutate("questionnaire", `${baseUrl}/questionnaire`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      assessmentId: workflow.assessment!.id,
                      answers: workflow.release!.questions.map((question) => ({
                        questionId: question.id,
                        optionId: answers[question.id],
                      })),
                    }),
                  });
                }}
              >
                {workflow.release.questions.map((question) => (
                  <fieldset key={question.id} className="rounded-md border p-4">
                    <legend className="px-1 text-sm font-semibold">
                      {question.questionText} {question.required ? `· ${labels.required}` : ""}
                    </legend>
                    {question.helpText ? (
                      <p className="mb-3 text-sm text-muted-foreground">{question.helpText}</p>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {question.options.map((option) => (
                        <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={answers[question.id] === option.id}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                            disabled={!workflow.canContribute}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                {workflow.canContribute ? (
                  <Button
                    className="self-start"
                    disabled={
                      busy !== null ||
                      workflow.release.questions.some((question) => !answers[question.id])
                    }
                    type="submit"
                  >
                    {busy === "questionnaire" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                    {labels.submitQuestionnaire}
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{labels.documents}</CardTitle>
              <CardDescription>{labels.documentHint}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {workflow.canContribute ? (
                <form
                  className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                  onSubmit={(event) => void uploadDocument(event, mutate, baseUrl)}
                >
                  <Input name="title" required placeholder={labels.documentTitle} />
                  <Input
                    name="file"
                    type="file"
                    required
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                    aria-label={labels.documentFile}
                  />
                  <Button type="submit" disabled={busy !== null}>
                    {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />}
                    {labels.upload}
                  </Button>
                </form>
              ) : null}
              <div className="grid gap-3">
                {workflow.documents.map((row) => {
                  const selectable =
                    row.document.status === "active" &&
                    row.version &&
                    row.embedding?.status === "succeeded";
                  const processingLabel =
                    row.embedding?.status === "succeeded"
                      ? labels.indexed
                      : row.embedding?.status === "failed" || row.extraction?.status === "failed"
                        ? labels.failed
                        : labels.processing;
                  return (
                    <div key={row.document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{row.document.title}</p>
                          <p className="text-xs text-muted-foreground">{row.version?.fileName} · {processingLabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {selectable && row.version ? (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedVersions.includes(row.version.id)}
                              onChange={(event) =>
                                setSelectedVersions((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, row.version!.id])]
                                    : current.filter((id) => id !== row.version!.id),
                                )
                              }
                            />
                            {labels.selectEvidence}
                          </label>
                        ) : null}
                        {workflow.canContribute && row.document.status === "active" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() =>
                              mutate(
                                `archive-${row.document.id}`,
                                `${baseUrl}/documents/${row.document.id}/archive`,
                                { method: "POST" },
                              )
                            }
                          >
                            {labels.archive}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">{labels.questionnaireOnly}</p>
              {workflow.canContribute && workflow.assessment.currentRevisionId ? (
                <Button
                  className="self-start"
                  disabled={busy !== null}
                  onClick={() =>
                    mutate("generate", `${baseUrl}/generate`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        assessmentId: workflow.assessment!.id,
                        selectedDocumentVersionIds: selectedVersions,
                        ...(workflow.run?.status === "failed"
                          ? { retryNonce: crypto.randomUUID() }
                          : {}),
                      }),
                    })
                  }
                >
                  {busy === "generate" ? <Loader2 className="animate-spin" /> : <Play />}
                  {workflow.run?.status === "failed" ? labels.retry : labels.generate}
                </Button>
              ) : null}
              {workflow.run?.status === "failed" ? (
                <Notice tone="error">{labels.runFailed} {workflow.run.errorMessage}</Notice>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      {workflow.revision ? (
        <Card>
          <CardHeader>
            <CardTitle>{labels.findings}</CardTitle>
            <CardDescription>
              {workflow.revision.status === "approved" ? labels.approved : workflow.revision.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {workflow.staleness?.stale ? <Notice tone="warning">{labels.stale}</Notice> : null}
            {workflow.staleness?.outdatedRelease ? <Notice tone="warning">{labels.outdatedRelease}</Notice> : null}
            {workflow.findings.map((row) => (
              <FindingCard
                key={row.finding.id}
                row={row}
                labels={labels}
                locale={locale}
                canManage={workflow.canManage}
                revisionId={workflow.revision!.id}
                baseUrl={baseUrl}
                busy={busy}
                mutate={mutate}
              />
            ))}
            {workflow.canManage && workflow.revision.status !== "approved" ? (
              <Button
                className="self-start"
                disabled={busy !== null || workflow.findings.some((row) => row.finding.requiresReview)}
                onClick={() =>
                  mutate(
                    "approve",
                    `${baseUrl}/revisions/${workflow.revision!.id}/approve`,
                    { method: "POST" },
                  )
                }
              >
                {busy === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {labels.approve}
              </Button>
            ) : !workflow.canManage ? (
              <p className="text-sm text-muted-foreground">{labels.ownerOnly}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FindingCard({ row, labels, locale, canManage, revisionId, baseUrl, busy, mutate }: {
  row: Workflow["findings"][number];
  labels: Labels;
  locale: Locale;
  canManage: boolean;
  revisionId: string;
  baseUrl: string;
  busy: string | null;
  mutate: (key: string, url: string, init?: RequestInit) => Promise<void>;
}) {
  const [status, setStatus] = useState(row.finding.status);
  const [reason, setReason] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const title = localized(row.requirement.title, locale);
  return (
    <article className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{row.requirement.code}</p>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs">
          {labels.statuses[row.finding.status]}
        </span>
      </div>
      {row.finding.requiresReview ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {labels.reviewRequired}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="font-medium">{labels.rationale}</dt><dd className="text-muted-foreground">{localized(row.finding.rationale, locale)}</dd></div>
        <div><dt className="font-medium">{labels.recommendation}</dt><dd className="text-muted-foreground">{localized(row.finding.recommendation, locale)}</dd></div>
        <div>
          <dt className="font-medium">{labels.citations}</dt>
          <dd className="mt-1 grid gap-2">
            {row.evidence.length ? row.evidence.map((evidence) => (
              <blockquote key={evidence.id} className="border-l-2 pl-3 text-muted-foreground">
                {evidence.excerpt}
                <span className="ml-2 text-xs">[{evidence.citationId}]</span>
              </blockquote>
            )) : labels.noCitations}
          </dd>
        </div>
      </dl>
      {canManage ? (
        <div className="mt-4 grid gap-3 rounded-md bg-muted/30 p-3">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            {Object.entries(labels.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={labels.correctionReason} />
          {row.finding.requiresReview ? (
            <Textarea value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} placeholder={labels.resolutionReason} />
          ) : null}
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={busy !== null || !reason.trim() || (row.finding.requiresReview && !resolutionReason.trim())}
            onClick={() =>
              mutate(`correct-${row.finding.id}`, `${baseUrl}/revisions/${revisionId}/correct`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  corrections: [{
                    findingId: row.finding.id,
                    status,
                    reason,
                    ...(row.finding.requiresReview
                      ? { requiresReview: false, resolutionReason }
                      : {}),
                  }],
                }),
              })
            }
          >
            {labels.saveCorrection}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

async function uploadDocument(
  event: FormEvent<HTMLFormElement>,
  mutate: (key: string, url: string, init?: RequestInit) => Promise<void>,
  baseUrl: string,
) {
  event.preventDefault();
  await mutate("upload", `${baseUrl}/documents`, {
    method: "POST",
    body: new FormData(event.currentTarget),
  });
}

function localized(value: unknown, locale: Locale) {
  const candidate = value as { de?: unknown; en?: unknown };
  const result = candidate[locale] ?? candidate.de ?? candidate.en;
  return typeof result === "string" ? result : "";
}

function Notice({ children, tone }: { children: ReactNode; tone: "error" | "warning" }) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${tone === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      {children}
    </div>
  );
}
