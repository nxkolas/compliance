"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";
import { OrganizationDocumentManager } from "@/components/documents/organization-document-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { getGapAnalysisWorkflow } from "@/src/server/gap-analysis/workflow-reader";
import type { Dictionary, Locale } from "@/lib/i18n";

type Workflow = Awaited<ReturnType<typeof getGapAnalysisWorkflow>>;
type Labels = Dictionary["modules"]["gapAnalysis"]["workflow"];
type DocumentLabels = Dictionary["modules"]["documents"]["workflow"];

export function GapAnalysisWorkflow({
  organizationId,
  workflow,
  labels,
  documentLabels,
  locale,
}: {
  organizationId: string;
  workflow: Workflow;
  labels: Labels;
  documentLabels: DocumentLabels;
  locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(workflow.answers);
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
              <CardTitle>{labels.questionnaireSource}</CardTitle>
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
                            onChange={() =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: option.id,
                              }))
                            }
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

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{labels.evidencePreparation}</h2>
            <OrganizationDocumentManager
              organizationId={organizationId}
              assessmentId={workflow.assessment.id}
              library={workflow.documentLibrary}
              reassessment={workflow.reassessment}
              labels={documentLabels}
              compact
            />
          </section>

          {workflow.reassessment ? (
            <ConfirmationCard
              workflow={workflow}
              labels={labels}
              busy={busy}
              mutate={mutate}
              baseUrl={baseUrl}
            />
          ) : null}
        </>
      )}

      <RevisionCard
        title={labels.candidateResult}
        empty={null}
        revision={workflow.candidateRevision}
        findings={workflow.candidateFindings}
        staleness={workflow.candidateStaleness}
        labels={labels}
        locale={locale}
        canManage={workflow.canManage}
        baseUrl={baseUrl}
        busy={busy}
        mutate={mutate}
        candidate
      />
      <RevisionCard
        title={labels.acceptedResult}
        empty={labels.noAcceptedResult}
        revision={workflow.acceptedRevision}
        findings={workflow.acceptedFindings}
        staleness={workflow.acceptedStaleness}
        labels={labels}
        locale={locale}
        canManage={false}
        baseUrl={baseUrl}
        busy={busy}
        mutate={mutate}
      />
    </div>
  );
}

function ConfirmationCard({ workflow, labels, busy, mutate, baseUrl }: {
  workflow: Workflow;
  labels: Labels;
  busy: string | null;
  mutate: (key: string, url: string, init?: RequestInit) => Promise<void>;
  baseUrl: string;
}) {
  const reassessment = workflow.reassessment!;
  const summary = reassessment.summary;
  const versionName = (id: string) =>
    workflow.documentLibrary.documents
      .flatMap((entry) => entry.versions)
      .find((item) => item.version.id === id)?.version.fileName ?? id;
  const status = reassessment.draft.status;
  const canGenerate = workflow.canContribute && status === "open";
  const canRetry = workflow.canContribute && status === "failed";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.confirmation}</CardTitle>
        <CardDescription>{status !== "open" ? labels.inputLocked : labels.documentHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Summary
            label={labels.baseRevision}
            value={summary.baseAcceptedGapRevisionNumber
              ? `#${summary.baseAcceptedGapRevisionNumber}`
              : "—"}
          />
          <Summary
            label={labels.questionnaireRevision}
            value={summary.assessmentRevisionNumber
              ? `#${summary.assessmentRevisionNumber}`
              : summary.assessmentRevisionId}
          />
          <Summary label={labels.release} value={summary.gapAnalysisReleaseVersion ?? summary.gapAnalysisReleaseId} />
          <Summary label={labels.requirementCount} value={String(summary.requirementCount)} />
          <Summary label={labels.carriedEvidence} value={names(summary.carried, versionName)} />
          <Summary label={labels.replacedEvidence} value={names(summary.replaced, versionName)} />
          <Summary label={labels.addedEvidence} value={names(summary.added, versionName)} />
          <Summary label={labels.removedEvidence} value={names(summary.removed, versionName)} />
          <div className="sm:col-span-2">
            <Summary
              label={labels.completeEvidence}
              value={names(summary.selectedDocumentVersionIds, versionName)}
            />
          </div>
        </dl>
        {canGenerate ? (
          <Button
            className="self-start"
            disabled={busy !== null}
            onClick={() =>
              mutate("generate", `${baseUrl}/reassessment/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  draftId: reassessment.draft.id,
                  expectedLockVersion: reassessment.draft.lockVersion,
                }),
              })
            }
          >
            {busy === "generate" ? <Loader2 className="animate-spin" /> : <Play />}
            {labels.generate}
          </Button>
        ) : canRetry ? (
          <Button
            className="self-start"
            disabled={busy !== null}
            onClick={() =>
              mutate("retry", `${baseUrl}/reassessment/retry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  draftId: reassessment.draft.id,
                  retryNonce: crypto.randomUUID(),
                }),
              })
            }
          >
            {busy === "retry" ? <Loader2 className="animate-spin" /> : <Play />}
            {labels.retry}
          </Button>
        ) : null}
        {workflow.run?.status === "failed" ? (
          <Notice tone="error">{labels.runFailed} {workflow.run.errorMessage}</Notice>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RevisionCard({
  title,
  empty,
  revision,
  findings,
  staleness,
  labels,
  locale,
  canManage,
  baseUrl,
  busy,
  mutate,
  candidate = false,
}: {
  title: string;
  empty: string | null;
  revision: Workflow["acceptedRevision"] | Workflow["candidateRevision"];
  findings: Workflow["acceptedFindings"] | Workflow["candidateFindings"];
  staleness: Workflow["acceptedStaleness"] | Workflow["candidateStaleness"];
  labels: Labels;
  locale: Locale;
  canManage: boolean;
  baseUrl: string;
  busy: string | null;
  mutate: (key: string, url: string, init?: RequestInit) => Promise<void>;
  candidate?: boolean;
}) {
  if (!revision && !empty) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {revision ? `${revision.status} · #${revision.revisionNumber}` : empty}
        </CardDescription>
      </CardHeader>
      {revision ? (
        <CardContent className="flex flex-col gap-4">
          {staleness?.stale ? <Notice tone="warning">{labels.stale}</Notice> : null}
          {staleness?.outdatedRelease ? <Notice tone="warning">{labels.outdatedRelease}</Notice> : null}
          {findings.map((row) => (
            <FindingCard
              key={row.finding.id}
              row={row}
              labels={labels}
              locale={locale}
              canManage={canManage}
              revisionId={revision.id}
              baseUrl={baseUrl}
              busy={busy}
              mutate={mutate}
            />
          ))}
          {candidate && canManage ? (
            <Button
              className="self-start"
              disabled={busy !== null || findings.some((row) => row.finding.requiresReview)}
              onClick={() =>
                mutate("approve", `${baseUrl}/revisions/${revision.id}/approve`, {
                  method: "POST",
                })
              }
            >
              {busy === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {labels.approve}
            </Button>
          ) : candidate && !canManage ? (
            <p className="text-sm text-muted-foreground">{labels.ownerOnly}</p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
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
  return (
    <article className="rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{row.requirement.code}</p>
          <h3 className="font-semibold">{localized(row.requirement.title, locale)}</h3>
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
        <Summary label={labels.rationale} value={localized(row.finding.rationale, locale)} />
        <Summary label={labels.recommendation} value={localized(row.finding.recommendation, locale)} />
        <div>
          <dt className="font-medium">{labels.citations}</dt>
          <dd className="mt-1 grid gap-2">
            {row.evidence.length ? row.evidence.map((evidence) => (
              <blockquote key={evidence.id} className="border-l-2 pl-3 text-muted-foreground">
                {evidence.excerpt}<span className="ml-2 text-xs">[{evidence.citationId}]</span>
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

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-medium">{label}</dt><dd className="text-muted-foreground">{value || "—"}</dd></div>;
}

function names(ids: string[], name: (id: string) => string) {
  return ids.length ? ids.map(name).join(", ") : "—";
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
