"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowBigRightDash,
  BarChart3,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type {
  OrganizationProgressStepKey,
  OrganizationProgressStepStatus,
} from "@/src/contracts/organization-progress";
import { useEffect, useState } from "react";

type TutorialWelcomeProps = {
  organizationId: string;
  labels: Dictionary["tutorial"];
};

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

  return (
    <section className="flex min-h-[calc(100svh-6.75rem)] w-full flex-col text-foreground sm:min-h-[calc(100svh-7.25rem)] md:min-h-[calc(100svh-7.75rem)] [@media(min-width:1280px)_and_(min-height:801px)]:-mb-4 [@media(min-width:1280px)_and_(min-height:801px)]:h-[calc(100svh-4.375rem)] [@media(min-width:1280px)_and_(min-height:801px)]:min-h-0 [@media(min-width:1280px)_and_(min-height:801px)]:overflow-hidden">
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
          const status: OrganizationProgressStepStatus =
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
            />
          );
        })}
      </ol>

      <div className="mt-8 grid flex-1 items-center gap-0 lg:-translate-y-8 lg:grid-cols-[minmax(300px,0.78fr)_minmax(460px,1.22fr)] xl:mt-14">
        <div className="relative z-30 flex min-h-[280px] items-end justify-center lg:translate-x-20 lg:translate-y-16">
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
                <span className="absolute left-[2%] top-[30%] flex h-[25%] w-[23%] items-center justify-center">
                  <span className="box-content flex h-[28.3px] w-[36.72px] origin-top-left -rotate-[17.09deg] items-center justify-center p-[3px]">
                    <RobotTrendIcon className="size-full text-white" />
                  </span>
                </span>
                <span className="absolute right-[2%] top-[29%] flex h-[25%] w-[23%] items-center justify-center">
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
                fill="url(#tutorial-bubble-gradient)"
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

            <div className="mt-auto flex min-h-12 w-full -translate-x-8 flex-wrap items-center justify-end gap-3 pt-4">
              {hasPreviousStep ? (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="inline-flex h-12 w-28 items-center justify-center overflow-hidden rounded-lg bg-[#002BFF]/50 text-base font-medium uppercase text-white/50 transition-colors hover:bg-[#002BFF]/60 hover:text-white/70"
                >
                  {labels.backAction}
                </button>
              ) : (
                <Link
                  href={dashboardHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#D9D9D9]/70 px-5 text-sm font-medium uppercase text-[#D9D9D9] shadow-[0_4px_4px_rgba(255,255,255,0.12)] transition-colors hover:bg-white/5 hover:text-white"
                >
                  <BarChart3 className="size-4" strokeWidth={1.5} />
                  {labels.dashboardAction}
                </Link>
              )}
              <button
                type="button"
                onClick={goToNextStep}
                className="inline-flex h-12 w-32 items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#002BFF] text-base font-medium uppercase text-white transition-colors hover:bg-[#0022cc]"
              >
                {!hasPreviousStep ? (
                  <StartButtonIcon className="size-4 shrink-0" />
                ) : null}
                {hasPreviousStep
                  ? labels.nextAction
                  : labels.startAction}
              </button>
            </div>
          </div>
        </article>
      </div>

      <p className="mt-auto max-w-[787px] pt-8 text-sm font-normal leading-6 text-zinc-500">
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

function ApplicabilityCheckStepIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 17 18"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11.2119 0.0127C11.3395 0.0382 11.4583 0.101 11.5518 0.1943L16.1357 4.7783C16.26 4.9029 16.33 5.0721 16.3301 5.248V15.665C16.33 16.2832 16.0845 16.8763 15.6475 17.3135C15.2103 17.7507 14.6163 17.997 13.998 17.9971H2.332C1.965 17.9971 1.6673 17.699 1.667 17.332C1.667 16.9648 1.9648 16.667 2.332 16.667H13.998C14.2636 16.6669 14.5193 16.5608 14.707 16.373C14.8946 16.1853 14.9999 15.9304 15 15.665V6.3301H10.665C10.2979 6.3301 10.0002 6.0322 10 5.665V1.3301H3.998C3.7326 1.3302 3.4778 1.4354 3.29 1.623C3.1022 1.8109 2.9971 2.0664 2.9971 2.332V4.832C2.9967 5.1988 2.6988 5.4967 2.332 5.4971C1.965 5.4971 1.6673 5.199 1.667 4.832V2.332C1.667 1.7136 1.9123 1.1199 2.3496 0.6826C2.7868 0.2455 3.3798 0.0001 3.998 0H11.082L11.2119 0.0127ZM3.165 7.5C4.0043 7.5 4.8098 7.8332 5.4033 8.4268C5.9969 9.0203 6.3301 9.8256 6.3301 10.665C6.33 11.2842 6.1483 11.8897 5.8223 12.3818L6.9688 13.5283C7.228 13.7881 7.2283 14.2092 6.9688 14.4688C6.7092 14.7283 6.2881 14.728 6.0283 14.4688L4.8818 13.3223C4.3756 13.6502 3.7822 13.8301 3.165 13.8301C2.3258 13.8301 1.5203 13.4967 0.9268 12.9033C0.3333 12.3098 0.0001 11.5043 0 10.665C0 9.8256 0.3332 9.0203 0.9268 8.4268C1.5203 7.8332 2.3256 7.5 3.165 7.5ZM3.165 8.8301C2.6784 8.8301 2.2113 9.0231 1.8672 9.3672C1.5231 9.7113 1.3301 10.1784 1.3301 10.665C1.3302 11.1516 1.5231 11.6188 1.8672 11.9629C2.2113 12.3068 2.6785 12.5 3.165 12.5C3.6516 12.5 4.1188 12.3068 4.4629 11.9629C4.8068 11.6188 5 11.1516 5 10.665C5 10.1784 4.8069 9.7113 4.4629 9.3672C4.1188 9.0231 3.6517 8.8301 3.165 8.8301ZM11.3301 5H14.4756L11.3301 1.8545V5Z"
        fill="currentColor"
      />
    </svg>
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

function TutorialStep({
  index,
  label,
  status,
  stepKey,
  stepLabel,
}: {
  index: number;
  label: string;
  status: OrganizationProgressStepStatus;
  stepKey: OrganizationProgressStepKey;
  stepLabel: string;
}) {
  const Icon = stepKey === "welcome" ? null : stepIcons[stepKey];
  const isCurrent = status === "current";
  const isCompleted = status === "completed";
  const isInactive = status === "upcoming" || status === "not_applicable";

  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className={`inline-flex h-36 w-40 min-w-0 flex-col items-center justify-start gap-2 text-center transition-opacity ${
        isInactive ? "opacity-20" : "opacity-100"
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
    </li>
  );
}
