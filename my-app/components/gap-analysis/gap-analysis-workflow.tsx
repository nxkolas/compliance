"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { History, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { gapAnalysisClient } from "@/src/client/gap-analysis";
import { jobsClient } from "@/src/client/jobs";
import { pollJob } from "@/src/client/job-polling";
import {
  deriveGapWorkflowNavigation,
  resolveGapPostGenerationView,
  type GapPostGenerationView,
  type GapWorkflowStep,
} from "@/src/server/gap-analysis/workflow-state";
import { GapAnalysisStepper } from "./gap-analysis-stepper";
import { GapDocumentStep } from "./gap-document-step";
import { localizeGapError } from "./gap-error";
import { GapQuestionnaireStep } from "./gap-questionnaire-step";
import { GapResultsStep } from "./gap-results-step";
import { GapReviewStep } from "./gap-review-step";
import type { GapLabels, GapLocale, GapWorkflow } from "./types";
import { GapInputsUsed } from "./gap-inputs-used";
import { GapHistory } from "./gap-history";
import type { JobDto } from "@/src/contracts/common/jobs";
import { GapMissingPrerequisiteState } from "./gap-missing-prerequisite-state";

export function GapAnalysisWorkflow({
  organizationId,
  workflow,
  labels,
  locale,
  initialStep,
  initialView,
}: {
  organizationId: string;
  workflow: GapWorkflow;
  labels: GapLabels;
  locale: GapLocale;
  initialStep: GapWorkflowStep;
  initialView: GapPostGenerationView;
}) {
  const router = useRouter();
  const [activeStep, setActiveStep] =
    useState<GapWorkflowStep>(initialStep);
  const [activeView, setActiveView] =
    useState<GapPostGenerationView>(initialView);
  const [loadedInputs, setLoadedInputs] = useState<
    GapWorkflow["generatedInputs"] | undefined
  >(initialView === "inputs" ? workflow.generatedInputs : undefined);
  const [loadedHistory, setLoadedHistory] = useState<
    GapWorkflow["history"] | undefined
  >(initialView === "history" ? workflow.history : undefined);
  const viewRequestRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(
    workflow.answers,
  );
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>(
    workflow.answers,
  );
  const [answerSaveState, setAnswerSaveState] = useState<
    "idle" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const questionnaireVersionRef = useRef(
    workflow.questionnaireDraft?.version ?? 1,
  );
  const questionnaireSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const questionnaireSaveFailedRef = useRef(false);
  const initialDocuments =
    workflow.analysisCycle?.selected.map((selection) => selection.documentId) ??
    [];
  const [selectedDocuments, setSelectedDocuments] =
    useState<string[]>(initialDocuments);
  const [savedDocuments, setSavedDocuments] =
    useState<string[]>(initialDocuments);
  const [inputsPrepared, setInputsPrepared] = useState(
    Boolean(workflow.analysisCycle),
  );
  const [pollingJobId, setPollingJobId] = useState<string | null>(
    workflow.analysisCycle?.draft.status === "locked"
      ? workflow.analysisCycle.draft.generationJobId
      : null,
  );
  const [generationJob, setGenerationJob] = useState<JobDto | null>(null);
  const answerDirty = useMemo(
    () => JSON.stringify(answers) !== JSON.stringify(savedAnswers),
    [answers, savedAnswers],
  );
  const documentDirty = useMemo(
    () =>
      [...selectedDocuments].sort().join("|") !==
      [...savedDocuments].sort().join("|"),
    [savedDocuments, selectedDocuments],
  );
  const dirty = answerDirty || documentDirty;
  const requiredQuestionCount =
    workflow.release?.questions.filter((question) => question.required)
      .length ?? 0;
  const answeredQuestionCount =
    workflow.release?.questions.filter(
      (question) => question.required && Boolean(answers[question.id]),
    ).length ?? 0;
  const navigation = deriveGapWorkflowNavigation({
    prerequisiteSatisfied: workflow.prerequisite.satisfied,
    hasAssessment: Boolean(workflow.assessment),
    answeredQuestionCount,
    requiredQuestionCount,
    hasPreparedInputs: inputsPrepared,
    hasResult: Boolean(workflow.revision),
    requestedStep: activeStep,
  });
  const renderedStep =
    workflow.lifecycleMode === "generating" ? "review" : activeStep;

  const navigate = useCallback(
    (step: GapWorkflowStep, replace = false) => {
      setActiveStep(step);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("step", step);
        window.history[replace ? "replaceState" : "pushState"](
          {},
          "",
          url,
        );
      }
    },
    [],
  );

  useEffect(() => {
    const onPopState = () => {
      const requested = new URL(window.location.href).searchParams.get(
        "step",
      ) as GapWorkflowStep | null;
      if (
        requested &&
        navigation.allowedSteps.includes(requested)
      ) {
        setActiveStep(requested);
      } else {
        setActiveStep(navigation.defaultStep);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigation.allowedSteps, navigation.defaultStep]);

  useEffect(() => {
    if (!workflow.lifecycle.showGeneratedViews) return;
    const onPopState = () => {
      setActiveView(
        resolveGapPostGenerationView(
          new URL(window.location.href).searchParams.get("view"),
        ),
      );
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [workflow.lifecycle.showGeneratedViews]);

  useEffect(() => {
    document.getElementById("gap-step-heading")?.focus();
  }, [activeStep]);

  useEffect(() => {
    if (!workflow.revision) return;
    if (activeView === "inputs" && loadedInputs === undefined) {
      const controller = new AbortController();
      viewRequestRef.current?.abort();
      viewRequestRef.current = controller;
      void gapAnalysisClient
        .getInputs(organizationId, workflow.revision.id, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setLoadedInputs(result.data.inputs as GapWorkflow["generatedInputs"]);
          }
        })
        .catch((caught) => {
          if (!controller.signal.aborted) setError(localizeGapError(caught, labels));
        });
    } else if (activeView === "history" && loadedHistory === undefined) {
      const controller = new AbortController();
      viewRequestRef.current?.abort();
      viewRequestRef.current = controller;
      void gapAnalysisClient
        .getHistory(organizationId, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setLoadedHistory(result.data.history as GapWorkflow["history"]);
          }
        })
        .catch((caught) => {
          if (!controller.signal.aborted) setError(localizeGapError(caught, labels));
        });
    }
    return () => viewRequestRef.current?.abort();
  }, [activeView, labels, loadedHistory, loadedInputs, organizationId, workflow.revision]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onDocumentClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (!link) return;
      const target = new URL(link.href, window.location.href);
      if (
        target.pathname !== window.location.pathname &&
        !window.confirm(labels.unsavedWarning)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [dirty, labels.unsavedWarning]);

  useEffect(() => {
    if (!pollingJobId) return;
    const controller = new AbortController();
    void pollJob({
      jobId: pollingJobId,
      signal: controller.signal,
      onUpdate: setGenerationJob,
      finalRefresh: () => {
        setPollingJobId(null);
        setGenerationJob(null);
        navigate("gaps", true);
        router.refresh();
      },
    }).catch((caught) => {
      if (!controller.signal.aborted) {
        setError(localizeGapError(caught, labels));
        setPollingJobId(null);
      }
    });
    return () => controller.abort();
  }, [labels, navigate, pollingJobId, router]);

  async function startAssessment() {
    setBusy("create");
    setError(null);
    try {
      await gapAnalysisClient.createAssessment(organizationId);
      navigate("questions", true);
      router.refresh();
    } catch (caught) {
      setError(localizeGapError(caught, labels));
    } finally {
      setBusy(null);
    }
  }

  async function saveQuestionnaire() {
    if (
      !workflow.assessment ||
      !workflow.release ||
      !workflow.questionnaireDraft
    ) return;
    setBusy("questionnaire");
    setError(null);
    try {
      await questionnaireSaveChainRef.current;
      if (questionnaireSaveFailedRef.current) return;
      await gapAnalysisClient.submitQuestionnaire(organizationId, {
        assessmentId: workflow.assessment.id,
        draftId: workflow.questionnaireDraft.id,
      });
      setSavedAnswers({ ...answers });
      navigate("documents");
      router.refresh();
    } catch (caught) {
      setError(localizeGapError(caught, labels));
    } finally {
      setBusy(null);
    }
  }

  function saveQuestionnaireAnswer(questionId: string, optionId: string) {
    const draft = workflow.questionnaireDraft;
    if (!draft) return Promise.resolve();
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
    setAnswerSaveState("saving");
    questionnaireSaveFailedRef.current = false;
    const task = questionnaireSaveChainRef.current.then(async () => {
      try {
        const result = await gapAnalysisClient.saveQuestionnaireAnswer(
          organizationId,
          questionId,
          {
            draftId: draft.id,
            optionId,
          },
        );
        questionnaireVersionRef.current = result.data.answer.version;
        setSavedAnswers((current) => ({ ...current, [questionId]: optionId }));
        setAnswerSaveState("saved");
      } catch (caught) {
        questionnaireSaveFailedRef.current = true;
        const conflict =
          caught instanceof Error &&
          "code" in caught &&
          caught.code === "GAP_QUESTIONNAIRE_DRAFT_CHANGED";
        setAnswerSaveState(conflict ? "conflict" : "error");
        setError(localizeGapError(caught, labels));
        if (conflict) router.refresh();
        throw caught;
      }
    });
    questionnaireSaveChainRef.current = task.catch(() => undefined);
    return task;
  }

  async function saveDocuments() {
    if (!workflow.assessment) return;
    setBusy("documents");
    setError(null);
    try {
      if (workflow.analysisCycle?.draft.status === "open") {
        await gapAnalysisClient.replaceGapAnalysisEvidence(organizationId, {
          cycleId: workflow.analysisCycle.draft.id,
          selectedDocumentIds: selectedDocuments,
        });
      } else {
        await gapAnalysisClient.prepareGapAnalysisCycle(organizationId, {
          assessmentId: workflow.assessment.id,
          selectedDocumentIds: selectedDocuments,
        });
      }
      setSavedDocuments([...selectedDocuments]);
      setInputsPrepared(true);
      navigate("review");
      router.refresh();
    } catch (caught) {
      setError(localizeGapError(caught, labels));
      if (
        caught instanceof Error &&
        "code" in caught &&
        caught.code === "GAP_DRAFT_CHANGED"
      ) {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function enqueueGeneration(kind: "generate" | "retry") {
    const analysisCycle = workflow.analysisCycle;
    if (!analysisCycle) return;
    setBusy(kind);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const result = await gapAnalysisClient.enqueueGapAnalysisGeneration(
        organizationId,
        analysisCycle.draft.id,
        kind === "generate"
          ? {
              operation: "start",
            }
          : { operation: "retry", retryNonce: idempotencyKey },
        idempotencyKey,
      );
      setPollingJobId(result.data.job.id);
      setGenerationJob(result.data.job);
      router.refresh();
    } catch (caught) {
      setError(localizeGapError(caught, labels));
    } finally {
      setBusy(null);
    }
  }

  async function cancelGeneration() {
    const jobId =
      workflow.analysisCycle?.draft.generationJobId ?? pollingJobId;
    if (!jobId) return;
    setBusy("cancel-generation");
    setError(null);
    try {
      const result = await jobsClient.cancel(jobId);
      setGenerationJob(result.data.job);
      if (result.data.job.state === "cancelled") setPollingJobId(null);
      router.refresh();
    } catch (caught) {
      setError(localizeGapError(caught, labels));
    } finally {
      setBusy(null);
    }
  }

  if (!workflow.release) {
    return <Notice tone="warning">{labels.unavailable}</Notice>;
  }
  if (!workflow.prerequisite.satisfied) {
    const blocked = getPrerequisitePresentation(
      workflow.prerequisite,
      labels,
      locale,
    );
    if (workflow.prerequisite.status === "missing") {
      return (
        <GapMissingPrerequisiteState
          destination={workflow.prerequisite.destination}
          title={blocked.title}
          description={blocked.description}
          action={blocked.action}
          whySequence={labels.prerequisiteWhySequence}
          infoTitle={labels.prerequisiteInfoTitle}
          infoDescription={labels.prerequisiteInfoDescription}
        />
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>{blocked.title}</CardTitle>
          <CardDescription>{blocked.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={workflow.prerequisite.destination}>
              {blocked.action}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!workflow.assessment && !workflow.lifecycle.showGeneratedViews) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.startTitle}</CardTitle>
          <CardDescription>{labels.startDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {workflow.canContribute ? (
            <Button
              disabled={Boolean(busy)}
              onClick={() => void startAssessment()}
            >
              {busy === "create" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play />
              )}
              {labels.startAnalysis}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{labels.readOnly}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (workflow.lifecycle.showGeneratedViews) {
    const navigateView = (view: GapPostGenerationView) => {
      setActiveView(view);
      const url = new URL(window.location.href);
      url.searchParams.delete("step");
      url.searchParams.set("view", view);
      window.history.pushState({}, "", url);
    };
    return (
      <div className="grid gap-6">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <nav
          aria-label={labels.generatedViews}
          className="flex flex-wrap gap-2 border-b pb-3"
          role="tablist"
        >
          <Button
            variant={activeView === "results" ? "default" : "outline"}
            onClick={() => navigateView("results")}
            role="tab"
            aria-selected={activeView === "results"}
          >
            {labels.resultsView}
          </Button>
          <Button
            variant={activeView === "inputs" ? "default" : "outline"}
            onClick={() => navigateView("inputs")}
            role="tab"
            aria-selected={activeView === "inputs"}
          >
            {labels.inputsUsed}
          </Button>
          <Button
            className="ml-auto"
            size="icon-sm"
            variant={activeView === "history" ? "default" : "outline"}
            onClick={() => navigateView("history")}
            role="tab"
            aria-selected={activeView === "history"}
            aria-label={labels.history}
            title={labels.history}
          >
            <History className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
        <Card role="tabpanel">
          <CardContent className="pt-6">
            {activeView === "history" ? (
              <GapHistory
                history={loadedHistory ?? []}
                labels={labels}
                locale={locale}
              />
            ) : activeView === "inputs" ? (
              <GapInputsUsed
                workflow={workflow}
                snapshot={loadedInputs}
                labels={labels}
              />
            ) : (
              <GapResultsStep
                organizationId={organizationId}
                workflow={workflow}
                labels={labels}
                locale={locale}
                onError={setError}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {workflow.lifecycleMode !== "generating" ? (
        <GapAnalysisStepper
          activeStep={activeStep}
          availableSteps={navigation.allowedSteps}
          labels={labels}
          onNavigate={navigate}
          variant="questionnaire"
        />
      ) : null}
      {renderedStep === "questions" ? (
        <GapQuestionnaireStep
          workflow={workflow}
          labels={labels}
          answers={answers}
          savedAnswers={savedAnswers}
          busy={busy === "questionnaire"}
          saveState={answerSaveState}
          onAnswer={saveQuestionnaireAnswer}
          onContinue={() => void saveQuestionnaire()}
        />
      ) : renderedStep === "review" ? (
        <GapReviewStep
          workflow={workflow}
          labels={labels}
          answers={answers}
          selected={selectedDocuments}
          busy={busy}
          generating={Boolean(pollingJobId)}
          generationJob={generationJob}
          editable={workflow.lifecycle.inputsEditable}
          locale={locale}
          onNavigate={navigate}
          onGenerate={() => void enqueueGeneration("generate")}
          onRetry={() => void enqueueGeneration("retry")}
          onCancel={() => void cancelGeneration()}
        />
      ) : (
        <Card>
          <CardContent className="pt-0">
            {renderedStep === "documents" ? (
            <GapDocumentStep
              organizationId={organizationId}
              workflow={workflow}
              labels={labels}
              selected={selectedDocuments}
              busy={busy === "documents"}
              onToggle={(versionId, checked) =>
                setSelectedDocuments((current) =>
                  checked
                    ? [...new Set([...current, versionId])]
                    : current.filter((id) => id !== versionId),
                )
              }
              onContinue={() => void saveDocuments()}
            />
          ) : (
            <GapResultsStep
              organizationId={organizationId}
              workflow={workflow}
              labels={labels}
              locale={locale}
              onError={setError}
            />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getPrerequisitePresentation(
  prerequisite: Extract<
    GapWorkflow["prerequisite"],
    { satisfied: false }
  >,
  labels: GapLabels,
  locale: GapLocale,
) {
  if (
    prerequisite.status === "not_eligible" &&
    prerequisite.reason === "unsupported_country"
  ) {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const countries = new Intl.ListFormat(locale, {
      style: "long",
      type: "conjunction",
    }).format(
      prerequisite.supportedCountryCodes.map(
        (code) => names.of(code) ?? code,
      ),
    );
    return {
      title: labels.prerequisiteUnsupportedTitle,
      description: labels.prerequisiteUnsupported.replace(
        "{countries}",
        countries,
      ),
      action: labels.reviewApplicability,
    };
  }
  if (
    prerequisite.status === "not_eligible" &&
    prerequisite.reason === "not_directly_in_scope"
  ) {
    return {
      title: labels.prerequisiteNotInScopeTitle,
      description: labels.prerequisiteNotInScope,
      action: labels.viewApplicability,
    };
  }
  if (prerequisite.status === "not_eligible") {
    return {
      title: labels.prerequisiteClarificationTitle,
      description: labels.prerequisiteClarification,
      action: labels.reviewApplicability,
    };
  }
  if (prerequisite.status === "missing") {
    return {
      title: labels.prerequisiteTitle,
      description: labels.prerequisite,
      action: labels.checkApplicability,
    };
  }
  return {
    title: labels.prerequisiteCurrentTitle,
    description: labels.prerequisiteCurrent,
    action: labels.checkCurrentApplicability,
  };
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error" | "warning";
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-foreground"
          : "border-primary/35 bg-primary/10 text-foreground"
      }`}
    >
      {children}
    </div>
  );
}
