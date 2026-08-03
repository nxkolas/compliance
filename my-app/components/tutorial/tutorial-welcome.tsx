"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowBigRightDash,
  BarChart3,
  ChevronLeft,
  FileSearch,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { OrganizationProgressStepKey } from "@/src/contracts/organization-progress";
import { useEffect, useState } from "react";

type TutorialWelcomeProps = {
  organizationId: string;
  labels: Dictionary["tutorial"];
};

type TutorialStepStatus =
  | "completed"
  | "current"
  | "upcoming"
  | "not_applicable";

const stepKeys = [
  "welcome",
  "applicability_check",
  "documents_uploaded",
  "gap_analysis",
  "action_plan",
  "next_steps",
] as const satisfies readonly OrganizationProgressStepKey[];

const stepIcons = {
  applicability_check: ApplicabilityCheckStepIcon,
  gap_analysis: GapAnalysisStepIcon,
  documents_uploaded: DocumentUploadStepIcon,
  action_plan: ActionPlanStepIcon,
  next_steps: ArrowBigRightDash,
} as const;

export function TutorialWelcome({
  organizationId,
  labels,
}: TutorialWelcomeProps) {
  const dashboardHref = `/tool/organizations/${organizationId}`;
  const applicabilityCheckHref = `/tool/organizations/${organizationId}/applicability-check`;
  const documentsHref = `/tool/organizations/${organizationId}/documents`;
  const gapAnalysisHref = `/tool/organizations/${organizationId}/gap-analysis`;
  const actionPlanHref = `/tool/organizations/${organizationId}/action-plan`;
  const storageKey = `comply:tutorial-progress:${organizationId}`;
  const legacyWelcomeStorageKey =
    `comply:tutorial-welcome:${organizationId}`;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const isDocumentsStep = currentStepIndex === 2;
  const hasPreviousStep = currentStepIndex > 0;
  const stepContent = [
    {
      title: "",
      lead: labels.welcomeQuestion,
      description: labels.welcomeDescription,
    },
    {
      title: labels.applicabilityTitle,
      lead: labels.applicabilityLead,
      description: labels.applicabilityDescription,
    },
    {
      title: labels.documentsTitle,
      lead: labels.documentsLead,
      description: labels.documentsDescription,
    },
    {
      title: labels.gapAnalysisTitle,
      lead: labels.gapAnalysisLead,
      description: labels.gapAnalysisDescription,
    },
    {
      title: labels.actionPlanTitle,
      lead: labels.actionPlanLead,
      description: labels.actionPlanDescription,
    },
    {
      title: labels.nextStepsTitle,
      lead: labels.nextStepsLead,
      description: labels.nextStepsDescription,
    },
  ] as const;
  const currentContent = stepContent[currentStepIndex];

  useEffect(() => {
    const storedStepIndex = readStoredTutorialStep(
      window.localStorage.getItem(storageKey),
    );
    const legacyWelcomeCompleted =
      window.localStorage.getItem(legacyWelcomeStorageKey) === "completed";
    const nextStepIndex =
      storedStepIndex ?? (legacyWelcomeCompleted ? 1 : 0);

    setCurrentStepIndex(nextStepIndex);
    storeTutorialProgress(storageKey, nextStepIndex);
    window.localStorage.removeItem(legacyWelcomeStorageKey);
  }, [legacyWelcomeStorageKey, storageKey]);

  function goToNextStep() {
    setCurrentStepIndex((currentIndex) => {
      const nextIndex = Math.min(currentIndex + 1, stepKeys.length - 1);
      storeTutorialProgress(storageKey, nextIndex);
      return nextIndex;
    });
  }

  function goToPreviousStep() {
    setCurrentStepIndex((currentIndex) => {
      const previousIndex = Math.max(currentIndex - 1, 0);
      storeTutorialProgress(storageKey, previousIndex);
      return previousIndex;
    });
  }

  function goToStep(stepIndex: number) {
    setCurrentStepIndex((currentIndex) => {
      const previousStepIndex = Math.min(
        Math.max(Math.trunc(stepIndex), 0),
        currentIndex,
      );
      storeTutorialProgress(storageKey, previousStepIndex);
      return previousStepIndex;
    });
  }

  return (
    <section className="flex min-h-[calc(100svh-6.75rem)] w-full flex-col text-foreground sm:min-h-[calc(100svh-7.25rem)] md:min-h-[calc(100svh-7.75rem)] [@media(min-width:1280px)_and_(min-height:801px)]:-mb-4 [@media(min-width:1280px)_and_(min-height:801px)]:h-[calc(100svh-4.375rem)] [@media(min-width:1280px)_and_(min-height:801px)]:min-h-0">
      <header className="w-full">
        <h1 className="flex w-full flex-wrap items-center gap-x-2 text-3xl leading-9 tracking-tight sm:text-4xl">
          <span className="font-bold">{labels.titlePrefix}</span>
          <span className="font-normal">{labels.titleProduct}</span>
          <Image
            src="/images/comply-x.svg"
            alt=""
            aria-hidden="true"
            width={18}
            height={24}
            className="h-7 w-auto brightness-0 dark:brightness-100"
          />
          {labels.titleSuffix ? (
            <span className="font-normal">{labels.titleSuffix}</span>
          ) : null}
        </h1>
        <p className="mt-3 max-w-[1081px] text-base font-normal leading-7 text-blue-200 md:min-h-10 md:text-lg">
          {labels.description}
        </p>
      </header>

      <ol
        aria-label={labels.titlePrefix}
        className="mt-10 grid min-w-[760px] grid-cols-6 gap-3 overflow-visible pb-2 max-lg:min-w-0 max-lg:grid-cols-3 max-sm:grid-cols-2 xl:mt-16"
      >
        {stepKeys.map((key, index) => {
          const status: TutorialStepStatus =
            index < currentStepIndex
              ? "completed"
              : index === currentStepIndex
                ? "current"
                : "upcoming";

          return (
            <TutorialStep
              key={key}
              index={index}
              label={labels.steps[key]}
              status={status}
              stepKey={key}
              stepLabel={labels.stepLabel}
              onSelect={
                index < currentStepIndex ? () => goToStep(index) : undefined
              }
            />
          );
        })}
      </ol>

      <div className="mt-8 grid flex-1 items-center gap-0 lg:-translate-y-8 lg:grid-cols-[minmax(300px,0.78fr)_minmax(460px,1.22fr)] xl:mt-14">
        <div className="pointer-events-none relative z-30 flex min-h-[280px] items-end justify-center lg:translate-x-20 lg:translate-y-16">
          <div className="relative w-full max-w-[430px]">
            <Image
              src="/images/Maskottchen_ohneLogo.svg"
              alt=""
              aria-hidden="true"
              width={520}
              height={350}
              priority
              className="h-auto w-full object-contain"
            />
            <span className="absolute left-[29.5%] top-[34%] flex h-[45%] w-[44%] items-center justify-center text-8xl font-bold leading-none text-primary">
              {currentStepIndex + 1}
            </span>
            {isDocumentsStep ? (
              <>
                <span className="absolute left-[0.3%] top-[33%] flex h-[25%] w-[23%] items-center justify-center">
                  <span className="box-content flex h-[38px] w-[49px] origin-top-left -rotate-[17.09deg] items-center justify-center p-[2px]">
                    <RobotTrendIcon className="size-full text-white" />
                  </span>
                </span>
                <span className="absolute right-[-0.6%] top-[29%] flex h-[25%] w-[23%] items-center justify-center">
                  <RobotUploadIcon className="size-12 origin-top-left -rotate-[7.06deg] text-primary" />
                </span>
              </>
            ) : null}
          </div>
        </div>

        <article className="relative isolate z-20 flex min-h-[320px] w-full max-w-[640px] flex-col justify-self-start px-8 py-6 text-white sm:px-10 sm:py-7 lg:-ml-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 748 364"
            fill="none"
            preserveAspectRatio="none"
            className="pointer-events-none absolute -left-5 top-0 z-0 h-full w-[calc(100%+20px)] overflow-visible"
          >
            <g filter="url(#tutorial-bubble-shadow)">
              <path
                d="M743.025 16.0351L740.833 343.18C740.789 349.807 735.38 355.155 728.753 355.124L30.0604 351.893C23.4555 351.862 18.1281 346.5 18.1406 339.895L18.6242 85.4893C18.6306 82.1332 17.2312 78.9308 14.7657 76.6589L5.18521 67.8312L15.3585 60.5303C18.5006 58.2754 20.3678 54.6478 20.3752 50.7841L20.4475 12.751C20.4602 6.10116 25.8782 0.718459 32.5281 0.749212L731.106 3.97987C737.733 4.01052 743.07 9.4078 743.025 16.0351Z"
                fill="#D9D9D9"
                fillOpacity="0.06"
              />
              <path
                d="M743.025 16.0351L740.833 343.18C740.789 349.807 735.38 355.155 728.753 355.124L30.0604 351.893C23.4555 351.862 18.1281 346.5 18.1406 339.895L18.6242 85.4893C18.6306 82.1332 17.2312 78.9308 14.7657 76.6589L5.18521 67.8312L15.3585 60.5303C18.5006 58.2754 20.3678 54.6478 20.3752 50.7841L20.4475 12.751C20.4602 6.10116 25.8782 0.718459 32.5281 0.749212L731.106 3.97987C737.733 4.01052 743.07 9.4078 743.025 16.0351Z"
                fill="url(#tutorial-bubble-gradient)"
                fillOpacity="0.44"
                stroke="#3D4049"
                strokeWidth="1.5"
              />
            </g>
            <defs>
              <filter
                id="tutorial-bubble-shadow"
                x="0"
                y="0"
                width="747.775"
                height="363.875"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset dy="4" />
                <feGaussianBlur stdDeviation="2" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                />
                <feBlend
                  mode="normal"
                  in2="BackgroundImageFix"
                  result="tutorialBubbleShadow"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="tutorialBubbleShadow"
                  result="shape"
                />
              </filter>
              <linearGradient
                id="tutorial-bubble-gradient"
                x1="740.753"
                y1="355.18"
                x2="470.991"
                y2="-217.914"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#111825" />
                <stop offset="1" stopColor="#1A2540" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative z-10 flex w-full max-w-[560px] flex-1 flex-col">
            {currentStepIndex === 0 ? (
              <>
                <h2 className="flex min-h-8 flex-wrap items-center gap-x-1.5 text-2xl font-bold leading-8">
                  <span>{labels.welcomeTitlePrefix}</span>
                  <span className="font-normal">{labels.productName}</span>
                  <Image
                    src="/images/comply-x.svg"
                    alt=""
                    aria-hidden="true"
                    width={13}
                    height={17}
                    className="h-[18px] w-auto brightness-0 dark:brightness-100"
                  />
                  <span>!</span>
                </h2>
              </>
            ) : (
              <h2 className="min-h-8 text-2xl font-bold leading-8">
                {currentContent.title}
              </h2>
            )}

            <div className="mt-3 w-full">
              <p className="text-xl font-normal leading-6 text-white">
                {currentContent.lead}
              </p>
              <p className="mt-6 text-base font-normal leading-6 text-[#D9D9D9]">
                {currentContent.description}
              </p>
            </div>

            <div className="mt-auto flex min-h-12 w-full items-center justify-between gap-3 pt-4">
              {hasPreviousStep ? (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  data-eigenschaft-1="Standard"
                  aria-label={labels.backAction}
                  className="relative z-40 inline-flex h-12 shrink-0 cursor-pointer items-center justify-start text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <span className="relative size-4 overflow-hidden" aria-hidden="true">
                    <ChevronLeft className="size-4" strokeWidth={1.3} />
                  </span>
                  <span className="w-16 text-left font-['Space_Grotesk'] text-[10px] font-medium uppercase leading-5">
                    {labels.backAction}
                  </span>
                </button>
              ) : null}

              <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                {!hasPreviousStep ? (
                  <Link
                    href={dashboardHref}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9]/70 px-5 font-['Space_Grotesk'] text-base font-medium uppercase text-[#D9D9D9] shadow-[0_4px_4px_rgba(255,255,255,0.12)] transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <BarChart3 className="size-5 shrink-0" strokeWidth={1.33} />
                    {labels.dashboardAction}
                  </Link>
                ) : null}
                {currentStepIndex === 1 ? (
                  <Link
                    href={applicabilityCheckHref}
                    className="inline-flex h-12 w-72 items-center justify-center gap-2 overflow-hidden rounded-lg px-5 font-['Space_Grotesk'] text-base font-medium text-white/70 shadow-[0px_4px_4px_0px_rgba(255,255,255,0.25)] outline outline-[1.5px] outline-offset-[-1.5px] outline-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <span
                      data-eigenschaft-1="Betroffenheitscheck"
                      className="relative size-5 shrink-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      <ApplicabilityCheckStepIcon
                        className="size-5 text-neutral-50"
                        strokeWidth={1.33}
                      />
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-center font-['Space_Grotesk'] text-base font-medium uppercase text-white/70">
                      {labels.applicabilityCheckAction}
                    </span>
                  </Link>
                ) : null}
                {isDocumentsStep ? (
                  <Link
                    href={documentsHref}
                    className="inline-flex h-12 w-72 items-center justify-center gap-2 overflow-hidden rounded-lg px-5 font-['Space_Grotesk'] text-base font-medium text-white/70 shadow-[0px_4px_4px_0px_rgba(255,255,255,0.25)] outline outline-[1.5px] outline-offset-[-1.5px] outline-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <FolderOpen
                      className="size-5 shrink-0"
                      strokeWidth={1.33}
                      aria-hidden="true"
                    />
                    <span className="shrink-0 whitespace-nowrap text-center font-['Space_Grotesk'] text-base font-medium uppercase text-white/70">
                      {labels.documentsLibraryAction}
                    </span>
                  </Link>
                ) : null}
                {currentStepIndex === 3 ? (
                  <Link
                    href={gapAnalysisHref}
                    className="inline-flex h-12 w-52 items-center justify-center gap-2 overflow-hidden rounded-lg px-5 font-['Space_Grotesk'] text-base font-medium text-white/70 shadow-[0px_4px_4px_0px_rgba(255,255,255,0.25)] outline outline-[1.5px] outline-offset-[-1.5px] outline-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <span
                      data-eigenschaft-1="Gap-Analyse"
                      className="relative size-5 shrink-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      <TrendingUp
                        className="size-5 text-neutral-50"
                        strokeWidth={1.33}
                      />
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-center font-['Space_Grotesk'] text-base font-medium uppercase text-white/70">
                      {labels.gapAnalysisAction}
                    </span>
                  </Link>
                ) : null}
                {currentStepIndex === 4 ? (
                  <Link
                    href={actionPlanHref}
                    className="inline-flex h-12 w-60 items-center justify-center gap-2 overflow-hidden rounded-lg px-5 font-['Space_Grotesk'] text-base font-medium text-white/70 shadow-[0px_4px_4px_0px_rgba(255,255,255,0.25)] outline outline-[1.5px] outline-offset-[-1.5px] outline-white/70 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <span
                      data-eigenschaft-1="Maßnahmenplan"
                      className="relative size-5 shrink-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      <ActionPlanStepIcon className="size-5 text-neutral-50/70" />
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-center font-['Space_Grotesk'] text-base font-medium text-white/70">
                      {labels.actionPlanAction}
                    </span>
                  </Link>
                ) : null}
                {currentStepIndex === stepKeys.length - 1 ? (
                  <Link
                    href={dashboardHref}
                    className="inline-flex h-12 w-48 items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#002BFF] px-5 font-['Space_Grotesk'] text-base font-medium uppercase text-white transition-colors hover:bg-[#0022cc]"
                  >
                    <span
                      data-eigenschaft-1="Dashboard"
                      className="relative size-5 shrink-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      <BarChart3 className="size-5 text-neutral-50" strokeWidth={1.33} />
                    </span>
                    <span className="shrink-0 whitespace-nowrap">
                      {labels.dashboardAction}
                    </span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="inline-flex h-12 w-32 items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#002BFF] px-5 font-['Space_Grotesk'] text-base font-medium uppercase text-white transition-colors hover:bg-[#0022cc]"
                  >
                    {!hasPreviousStep ? (
                      <StartButtonIcon className="size-5 shrink-0" />
                    ) : null}
                    {hasPreviousStep
                      ? labels.nextAction
                      : labels.startAction}
                  </button>
                )}
              </div>
            </div>
          </div>

          {currentStepIndex === stepKeys.length - 1 ? (
            <div className="absolute top-[calc(100%+18px)] right-1 z-30 h-24 w-96 rounded-xl bg-gradient-to-br from-gray-900 to-slate-800 outline outline-1 outline-offset-[-1px] outline-indigo-50/20">
              <div className="absolute inset-x-0 top-6 flex justify-center px-4">
                <div className="flex flex-col items-start gap-3">
                  <div className="whitespace-nowrap font-['Space_Grotesk'] text-xl leading-5 font-semibold text-white">
                    {labels.whyOrderTitle}
                  </div>
                  <div
                    data-eigenschaft-1="Standard"
                    className="inline-flex h-6 items-center gap-1.5"
                  >
                    <ContinuePuzzleIcon className="size-5 shrink-0 text-white" />
                    <div className="inline-flex items-baseline gap-1 whitespace-nowrap font-['Space_Grotesk'] text-base leading-6 font-normal text-white/90">
                      <span>{labels.whyOrderMorePrefix}</span>
                      <span className="inline-flex items-baseline">
                        <span>comply</span>
                        <Image
                          src="/images/comply-x.svg"
                          alt=""
                          aria-hidden="true"
                          width={12}
                          height={16}
                          className="h-4 w-3 brightness-0 invert"
                        />
                      </span>
                      <span>{labels.whyOrderMoreSuffix}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <p className="mt-auto max-w-[787px] translate-y-2 pt-8 text-sm font-normal leading-6 text-zinc-500">
        {labels.disclaimer}
      </p>
    </section>
  );
}

function readStoredTutorialStep(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as {
      currentStep?: unknown;
    };
    const index = stepKeys.findIndex(
      (stepKey) => stepKey === parsed.currentStep,
    );

    return index >= 0 ? index : null;
  } catch {
    return null;
  }
}

function storeTutorialProgress(storageKey: string, currentStepIndex: number) {
  const normalizedStepIndex = Math.min(
    Math.max(Math.trunc(currentStepIndex), 0),
    stepKeys.length - 1,
  );

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        currentStep: stepKeys[normalizedStepIndex],
        completedSteps: stepKeys.slice(0, normalizedStepIndex),
      }),
    );
  } catch {
    // The tutorial remains usable in memory if browser storage is unavailable.
  }
}

function StartButtonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7.9997 14.6673C11.6816 14.6673 14.6663 11.6825 14.6663 8.0007C14.6663 4.3188 11.6816 1.334 7.9997 1.334C4.3178 1.334 1.333 4.3188 1.333 8.0007C1.333 11.6825 4.3178 14.6673 7.9997 14.6673Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.6663 5.334L10.6663 8.0007L6.6663 10.6673V5.334Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ApplicabilityCheckStepIcon({
  className,
  strokeWidth = 1.33,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <FileSearch
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    />
  );
}

function GapAnalysisStepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 10"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M17.3321 0C17.6992 0.0002 17.9972 0.2979 17.9972 0.665V5.665C17.9972 6.0322 17.6992 6.3299 17.3321 6.3301C16.9649 6.33 16.6671 6.0322 16.6671 5.665V2.2705L10.7188 8.2188C10.4592 8.4783 10.0381 8.4783 9.7784 8.2188L6.0812 4.5215L1.1358 9.4688C0.8761 9.7284 0.4541 9.7284 0.1944 9.4688C-0.0649 9.2092 -0.0648 8.788 0.1944 8.5283L5.6114 3.1113C5.871 2.8517 6.2921 2.8519 6.5519 3.1113L10.2481 6.8076L15.7257 1.3301H12.3321C11.9649 1.33 11.6671 1.0322 11.6671 0.665C11.6671 0.2978 11.9649 0.0001 12.3321 0H17.3321Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DocumentUploadStepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 12.5V15.8333C2.5 16.7538 3.24619 17.5 4.16667 17.5H15.8333C16.7538 17.5 17.5 16.7538 17.5 15.8333V12.5M5.83333 6.66667L10 2.5M10 2.5L14.1667 6.66667M10 2.5V12.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RobotTrendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 36"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5.5 31L12.25 17.5L23 21L29.5 7.5M29.5 7.5L20.75 9.75M29.5 7.5L32 16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RobotUploadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8.64 27.33V35.33C8.64 38.64 11.33 41.33 14.64 41.33H34.64C37.95 41.33 40.64 38.64 40.64 35.33V27.33"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.11 18.87L23.11 6.87L33.11 18.87M23.32 7.98V27.98"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionPlanStepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 7.2V10M10 12.8H10.0075M10 17C10 17 16 14.2 16 10V5.1L10 3L4 5.1V10C4 14.2 10 17 10 17Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ContinuePuzzleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6.66667 10H13.3333M10 6.66667L13.3333 10L10 13.3333M4.16667 2.5H15.8333C16.7538 2.5 17.5 3.24619 17.5 4.16667V15.8333C17.5 16.7538 16.7538 17.5 15.8333 17.5H4.16667C3.24619 17.5 2.5 16.7538 2.5 15.8333V4.16667C2.5 3.24619 3.24619 2.5 4.16667 2.5Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TutorialStep({
  index,
  label,
  status,
  stepKey,
  stepLabel,
  onSelect,
}: {
  index: number;
  label: string;
  status: TutorialStepStatus;
  stepKey: OrganizationProgressStepKey;
  stepLabel: string;
  onSelect?: () => void;
}) {
  const Icon = stepKey === "welcome" ? null : stepIcons[stepKey];
  const isCurrent = status === "current";
  const isCompleted = status === "completed";
  const isInactive = status === "upcoming" || status === "not_applicable";

  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className="h-36 w-40 min-w-0"
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        aria-label={onSelect ? `${stepLabel} ${index + 1}: ${label}` : undefined}
        className={`inline-flex h-full w-full min-w-0 flex-col items-center justify-start gap-2 rounded-lg border-0 bg-transparent p-0 text-center text-inherit transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isInactive ? "opacity-20" : "opacity-100"
        } ${
          onSelect
            ? "cursor-pointer hover:opacity-80"
            : "cursor-default"
        }`}
      >
        <div className="flex flex-col items-start justify-start pb-2">
          <span className="text-xs font-medium leading-4">
            {stepLabel} {index + 1}
          </span>
        </div>
        <span
          className={`inline-flex size-14 shrink-0 items-center justify-center rounded-full text-white outline outline-[1.5px] outline-offset-[-1.5px] ${
            isCompleted
              ? "bg-[#46A95A] outline-white"
              : "bg-primary outline-foreground"
          }`}
        >
          {stepKey === "welcome" ? (
            <Image
              src="/images/comply-x.svg"
              alt=""
              aria-hidden="true"
              width={20}
              height={28}
              className="h-7 w-5"
            />
          ) : (
            Icon ? <Icon className="size-5" strokeWidth={1.5} /> : null
          )}
        </span>
        <div className="flex flex-col items-start justify-start pt-3">
          {stepKey === "welcome" ? (
            <span className="text-center text-base font-normal leading-5">
              {label.split(" ").slice(0, -1).join(" ")}
              <br />
              <span className="inline-flex items-baseline">
                {label.split(" ").at(-1)}
                <Image
                  src="/images/comply-x.svg"
                  alt=""
                  aria-hidden="true"
                  width={8}
                  height={11}
                  className="ml-0.5 h-[11px] w-2 brightness-0 dark:brightness-100"
                />
              </span>
            </span>
          ) : (
            <span className="max-w-40 text-center text-base font-normal leading-5">
              {label}
            </span>
          )}
        </div>
        <div className="h-7 w-14 pt-2" />
      </button>
    </li>
  );
}
