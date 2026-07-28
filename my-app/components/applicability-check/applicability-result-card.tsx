"use client";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";
import type { ApplicabilityResultDto } from "@/src/server/applicability-check/service";
import {
  BadgeAlert,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileText,
  ShieldAlert,
  Target,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ComponentType, type ReactNode, useState } from "react";

type ApplicabilityResultCardProps = {
  result: ApplicabilityResultDto;
  locale: Locale;
  labels: {
    ruleSet: string;
    release: string;
    outdated: string;
    startCurrent: string;
    unknown: string;
    revision: string;
    outcome: string;
    profile: string;
    jurisdiction: string;
    size: string;
    reasoning: string;
    entityTypes: string;
    legalBasis: string;
    unresolved: string;
    overlays: string;
    indirect: string;
    indirectNone: string;
    unsupportedCountryTitle: string;
    unsupportedCountryBody: string;
    outcomes: {
      essentialEntity: string;
      importantEntity: string;
      notDirectlyInScope: string;
      clarificationRequired: string;
    };
    whyTitle?: string;
    meaningTitle?: string;
    startGap?: string;
    detailsTitle?: string;
    expandAll?: string;
    collapseAll?: string;
    basedOn?: string;
    asOf?: string;
  };
  title: string;
  startCurrentHref: string;
  gapAnalysisHref?: string;
  recalculationLocked?: boolean;
};

type DetailSection = {
  content: ReactNode;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  id: string;
  title: string;
};

export function ApplicabilityResultCard({
  result,
  locale,
  labels,
  title,
  startCurrentHref,
  gapAnalysisHref,
  recalculationLocked = false,
}: ApplicabilityResultCardProps) {
  const evaluation = result.result;
  const presentation = getOutcomePresentation(evaluation.outcome);
  const isEssentialEntity = evaluation.outcome === "essential_entity";
  const isImportantEntity = evaluation.outcome === "important_entity";
  const isNotDirectlyInScope =
    evaluation.outcome === "not_directly_in_scope";
  const isShieldEntity = isEssentialEntity || isImportantEntity;
  const copy = getOutcomeCopy(evaluation.outcome, locale);
  const speechBubbleMeaning = copy.meaning;
  const reasons = locale === "en" ? evaluation.reasonsEn : evaluation.reasons;
  const unresolved =
    locale === "en"
      ? evaluation.unresolvedFactsEn
      : evaluation.unresolvedFacts;
  const indirectReasons =
    locale === "en"
      ? evaluation.indirectExposure.reasonsEn
      : evaluation.indirectExposure.reasons;
  const unsupportedCountry =
    result.evidence.unresolvedFactCodes.includes(
      "unresolved_unsupported_profile",
    );
  const supportedCountries = formatCountryNames(
    result.release.supportedCountryCodes,
    locale,
  );
  const entityTypeValue = formatEntityTypes(
    evaluation.matchedEntityTypes,
    locale,
    labels.unknown,
  );
  const jurisdictionValue = formatCountry(
    evaluation.jurisdiction.countryCode,
    locale,
    labels.unknown,
  );
  const canStartGapAnalysis =
    Boolean(gapAnalysisHref) && isShieldEntity && !unsupportedCountry;
  const details = getDetailSections({
    evaluation,
    indirectReasons,
    labels,
    locale,
    unresolved,
  });

  return (
    <div className="flex flex-col gap-8">
      {result.release.isOutdated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
          <span>{labels.outdated}</span>
          {!recalculationLocked ? (
            <Button asChild size="sm">
              <Link href={startCurrentHref}>{labels.startCurrent}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {unsupportedCountry ? (
        <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-amber-100">
          <h2 className="font-semibold">
            {labels.unsupportedCountryTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-50/75">
            {labels.unsupportedCountryBody.replace(
              "{countries}",
              supportedCountries,
            )}
          </p>
        </div>
      ) : null}

      <section
        className={cn(
          "relative overflow-hidden rounded-xl border-[1.5px] bg-[#1B1E27] px-5 py-5 shadow-[0_4px_4px_rgba(0,0,0,0.25)] sm:px-8 sm:py-6",
          presentation.borderClass,
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-28 -right-16 size-72 rounded-full blur-3xl",
            presentation.glowClass,
          )}
        />

        <div
          className={cn(
            "relative flex items-center",
            isShieldEntity && "items-start sm:-mt-[7px] sm:-ml-3",
          )}
        >
          {isEssentialEntity ? (
            <EssentialOutcomeIcon />
          ) : isImportantEntity ? (
            <ImportantOutcomeIcon />
          ) : presentation.redIcon ? (
            <RedOutcomeIcon className="size-14 sm:size-[71px]" />
          ) : presentation.purpleIcon ? (
            <PurpleOutcomeIcon />
          ) : (
            <div
              className={cn(
                "grid size-16 shrink-0 place-items-center rounded-full border-[1.5px] bg-gray-950 shadow-[0_0_0_10px_rgba(255,255,255,0.025)]",
                presentation.iconClass,
              )}
            >
              <presentation.Icon className="size-8" strokeWidth={1.8} />
            </div>
          )}
          <div
            className={cn(
              "flex min-w-0 max-w-full items-center rounded-r-full border-y-[1.5px] border-r-[1.5px]",
              isShieldEntity
                ? "-ml-[14px] mt-5 h-10 py-1 pr-2 pl-3 sm:pr-2.5 sm:pl-4"
                : "min-h-10 py-2 pr-3 pl-5 sm:pr-5 sm:pl-8",
              isEssentialEntity &&
                "sm:w-[360px] sm:shrink-0 sm:pr-8",
              !isShieldEntity &&
                (presentation.purpleIcon
                  ? "-ml-4 pl-4"
                  : isNotDirectlyInScope
                    ? "-ml-3 pr-2 pl-3 sm:-ml-4 sm:pr-5 sm:pl-8"
                    : "-ml-4"),
              presentation.badgeClass,
            )}
          >
            <p
              className={cn(
                "min-w-0 whitespace-nowrap leading-4 font-semibold uppercase sm:text-xl sm:leading-5 sm:tracking-[0.08em]",
                isNotDirectlyInScope
                  ? "text-[9px] tracking-[0.01em] min-[360px]:text-[10px]"
                  : "text-[11px] tracking-[0.04em] min-[360px]:text-xs",
                presentation.textClass,
              )}
            >
              {title}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "relative",
            isShieldEntity
              ? "mt-0 sm:-mt-4 sm:mr-10 sm:ml-[63px]"
              : "mt-6 sm:mx-10",
            presentation.purpleIcon && "sm:pl-4",
          )}
        >
          <p className="max-w-[68rem] text-sm leading-6 text-white sm:text-base sm:leading-7">
            {copy.summary}
          </p>

          <div
            className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,11.5rem),1fr))] gap-4 min-[1280px]:gap-6 min-[1600px]:gap-10"
          >
            <Metric
              icon={Building2}
              label={labels.size}
              presentation={presentation}
              value={formatSize(evaluation.sizeClassification, locale)}
            />
            <Metric
              icon={Target}
              label={locale === "en" ? "Entity type" : "Einrichtungsart"}
              presentation={presentation}
              value={entityTypeValue}
            />
            <Metric
              icon={JurisdictionIcon}
              label={labels.jurisdiction}
              presentation={presentation}
              value={jurisdictionValue}
            />
          </div>

          <div className="mt-8">
            <h2
              className="text-base font-semibold tracking-[0.04em] text-white uppercase sm:text-xl"
            >
              {labels.whyTitle ??
                (locale === "en"
                  ? "Why did you receive this result?"
                  : "Warum erhalten Sie dieses Ergebnis?")}
            </h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-white sm:text-base">
              {(reasons.length > 0 ? reasons : [copy.summary]).map((reason) => (
                <li
                  key={reason}
                  className="flex min-w-0 items-start gap-3"
                >
                  <span
                    className={cn(
                      "mt-[0.6rem] size-1.5 shrink-0 rounded-full",
                      presentation.dotClass,
                    )}
                  />
                  <span className="min-w-0">{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid items-center gap-6 min-[1280px]:mx-auto min-[1280px]:mt-4 min-[1280px]:w-full min-[1280px]:max-w-[1278.5px] min-[1280px]:grid-cols-[minmax(0,1.46fr)_minmax(0,1fr)] min-[1280px]:gap-[52px]">
        <div className="relative flex min-h-72 w-full max-w-[758.5px] flex-col items-start justify-center px-6 py-10 sm:px-[54px] min-[1280px]:justify-start min-[1280px]:pt-[65px] min-[1280px]:pb-[30px]">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-800 to-gray-900 outline outline-[1.5px] outline-offset-[-0.75px] outline-zinc-700 min-[1280px]:hidden"
          />
          <SpeechBubbleBackground />
          <h2 className="relative z-10 w-full max-w-80 text-lg font-semibold tracking-wide text-white uppercase sm:text-xl min-[1280px]:leading-5">
            {labels.meaningTitle ??
              (locale === "en"
                ? "What does this mean for you?"
                : "Was bedeutet das für Sie?")}
          </h2>
          <p className="relative z-10 mt-4 max-w-[639px] text-base leading-7 font-normal text-white">
            {speechBubbleMeaning}
          </p>
          {canStartGapAnalysis && gapAnalysisHref ? (
            <Button
              asChild
              className="relative z-10 mt-6 h-12 w-full max-w-64 overflow-hidden rounded-lg bg-[#002BFF] px-6 font-['Space_Grotesk'] text-base font-medium text-white outline outline-[1.5px] outline-offset-[-1.5px] outline-[#002BFF] hover:bg-[#002BFF]"
            >
              <Link href={gapAnalysisHref}>
                <TrendingUp
                  className="absolute left-5 size-5"
                  strokeWidth={1.5}
                />
                <span className="translate-x-2">
                  {labels.startGap ??
                    (locale === "en"
                      ? "Start Gap Analysis"
                      : "Gap-Analyse starten")}
                </span>
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="flex items-center justify-center min-[1280px]:min-h-72 min-[1280px]:translate-y-[19px] min-[1280px]:justify-end">
          <Image
            src="/images/Maskottchen_ohneLogo.svg"
            alt=""
            aria-hidden="true"
            width={520}
            height={350}
            className="h-auto w-full max-w-[360px] sm:max-w-[430px] min-[1280px]:max-w-[520px]"
          />
        </div>
      </section>

      <ResultDetails
        collapseAllLabel={
          labels.collapseAll ??
          (locale === "en" ? "Collapse all" : "Alle schließen")
        }
        expandAllLabel={
          labels.expandAll ??
          (locale === "en" ? "Expand all" : "Alle anzeigen")
        }
        sections={details}
        title={
          labels.detailsTitle ??
          (locale === "en"
            ? "Details and legal bases"
            : "Details und Grundlagen")
        }
      />

      <footer className="min-[1280px]:mt-[18px]">
        <div className="flex items-start gap-3 rounded-lg border-[1.5px] border-zinc-700 bg-[#1B1E27] px-5 py-2.5 text-xs leading-5 text-white/35">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            className="mt-0.5 size-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 8C2 8.78793 2.15519 9.56815 2.45672 10.2961C2.75825 11.0241 3.20021 11.6855 3.75736 12.2426C4.31451 12.7998 4.97595 13.2417 5.7039 13.5433C6.43185 13.8448 7.21207 14 8 14C8.78793 14 9.56815 13.8448 10.2961 13.5433C11.0241 13.2417 11.6855 12.7998 12.2426 12.2426C12.7998 11.6855 13.2417 11.0241 13.5433 10.2961C13.8448 9.56815 14 8.78793 14 8C14 6.4087 13.3679 4.88258 12.2426 3.75736C11.1174 2.63214 9.5913 2 8 2C6.4087 2 4.88258 2.63214 3.75736 3.75736C2.63214 4.88258 2 6.4087 2 8Z"
              stroke="#9F9FA9"
              strokeWidth="1.33"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 6H8.00667"
              stroke="#9F9FA9"
              strokeWidth="1.33"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7.33301 8H7.99967V10.6667H8.66634"
              stroke="#9F9FA9"
              strokeWidth="1.33"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p>
            {locale === "en" ? evaluation.disclaimerEn : evaluation.disclaimer}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-zinc-400 min-[1280px]:mt-5">
          <Metadata label={labels.release} value={result.release.versionLabel} />
          <Metadata
            label={
              labels.basedOn ?? (locale === "en" ? "Based on" : "Basiert auf")
            }
            value={result.ruleSetVersionLabel ?? labels.unknown}
          />
          <Metadata
            label={labels.profile}
            value={
              evaluation.jurisdiction.countryProfileVersion ??
              result.evidence.scopeModelVersion
            }
          />
          <span className="ml-0 lg:ml-auto">
            {labels.asOf ?? (locale === "en" ? "As of" : "Stand")}:{" "}
            {formatDate(result.createdAt, locale)}
          </span>
        </div>
      </footer>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  presentation,
  value,
}: {
  icon: LucideIcon | typeof JurisdictionIcon;
  label: string;
  presentation: ReturnType<typeof getOutcomePresentation>;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-24 min-w-0 flex-col justify-center rounded-xl border-[1.5px] px-5 py-4 sm:px-6",
        presentation.metricBackgroundClass,
        presentation.metricBorderClass,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-sm font-medium tracking-wide sm:text-base min-[1600px]:text-lg min-[1600px]:leading-4",
          presentation.textClass,
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.5} />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <p
        className="mt-2 break-words whitespace-normal pl-0.5 text-sm text-white sm:text-base"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function SpeechBubbleBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-[0.25px] hidden h-full w-[calc(100%+24px)] overflow-visible min-[1280px]:block"
      viewBox="0 0 782 288"
      fill="none"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 0H746C752.627 0 758 5.37258 758 12V125C758 130 760.8 134.6 765.2 136.8L782 144L765.2 152C760.8 154.2 758 158 758 163V276C758 282.627 752.627 288 746 288H12C5.37258 288 0 282.627 0 276V12C0 5.37258 5.37258 0 12 0Z"
        fill="url(#applicability-speech-bubble-gradient)"
        stroke="#3D4049"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <defs>
        <linearGradient
          id="applicability-speech-bubble-gradient"
          x1="0"
          y1="0"
          x2="782"
          y2="288"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1E293B" />
          <stop offset="1" stopColor="#101828" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ResultDetails({
  collapseAllLabel,
  expandAllLabel,
  sections,
  title,
}: {
  collapseAllLabel: string;
  expandAllLabel: string;
  sections: DetailSection[];
  title: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const allExpanded =
    sections.length > 0 && expanded.size === sections.length;

  function toggleSection(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(
      allExpanded ? new Set() : new Set(sections.map((section) => section.id)),
    );
  }

  return (
    <section className="mt-12 min-[1280px]:mt-[92px]">
      <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="text-base font-medium tracking-[0.04em] text-white uppercase sm:text-lg">
          {title}
        </h2>
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex shrink-0 self-end items-center gap-2 text-sm font-medium text-white transition-colors hover:text-blue-200 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:self-auto sm:text-base"
        >
          {allExpanded ? collapseAllLabel : expandAllLabel}
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              allExpanded && "rotate-180",
            )}
          />
        </button>
      </div>

      <div className="grid gap-4 min-[1280px]:gap-[22px]">
        {sections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expanded.has(section.id);

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-xl border-[1.5px] border-zinc-700 bg-[#1B1E27]"
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleSection(section.id)}
                className="flex min-h-12 w-full items-center justify-between gap-4 bg-[#1B1E27] px-5 py-3.5 text-left font-['Space_Grotesk'] text-[#9F9FA9] transition-colors hover:bg-white/[0.025] hover:text-[#9F9FA9] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  <span className="truncate text-lg leading-5 font-medium">
                    {section.title}
                  </span>
                </span>
                <DetailChevron
                  className={cn(
                    "size-3.5 shrink-0 transition-transform",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>
              <div
                hidden={!isExpanded}
                className="border-t border-zinc-700 px-5 py-5 text-sm leading-6 text-zinc-300"
              >
                {section.content}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EssentialOutcomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-20 w-16 shrink-0 sm:h-24 sm:w-20"
      viewBox="20 17 81 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="essential-shield-outer"
          x1="22.0003"
          y1="17"
          x2="98.1742"
          y2="106.702"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4CDB69" />
          <stop offset="1" stopColor="#1E4E24" />
        </linearGradient>
        <linearGradient
          id="essential-shield-inner"
          x1="22"
          y1="17"
          x2="98.1738"
          y2="106.702"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7CCB8C" />
          <stop offset="1" stopColor="#1E3021" />
        </linearGradient>
        <linearGradient
          id="essential-shield-border"
          x1="21.9997"
          y1="17"
          x2="98.1735"
          y2="106.702"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#208835" />
          <stop offset="1" stopColor="#8FFFA6" />
        </linearGradient>
      </defs>

      <path
        d="M60.5003 20.1786L28.417 32.8929V61.5C28.417 78.9822 42.8545 93.2857 60.5003 102.821C78.1462 93.2857 92.5837 78.9822 92.5837 61.5V32.8929L60.5003 20.1786Z"
        fill="url(#essential-shield-outer)"
        fillOpacity="0.15"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.0194 51.08L56.2795 61.2205L50.2734 74.2161L55.9303 74.3145L59.2128 66.8322L62.6348 74.413L68.2917 74.2161L61.9364 61.0236C61.9364 61.0236 64.2528 55.9369 65.4982 53.7382C66.6904 51.6335 68.0124 49.5704 69.4092 47.8311C70.7843 46.1187 72.6566 44.4345 73.8788 43.3023C74.7934 42.4551 76.7422 41.038 76.7422 41.038C76.7422 41.038 70.4889 43.3247 68.8504 44.6807C67.8468 45.5113 66.7576 46.4271 65.7776 47.4373C64.6951 48.553 63.4079 49.9236 62.3555 51.3754C61.273 52.8686 59.2826 56.3964 59.2826 56.3964L56.9779 50.9815L52.0194 51.08Z"
        fill="#00CB11"
      />
      <path
        d="M60.5 23.3572L31.625 34.4822V61.5C31.625 77.3929 44.4583 90.9018 60.5 99.6429C76.5417 90.9018 89.375 77.3929 89.375 61.5V34.4822L60.5 23.3572Z"
        fill="url(#essential-shield-inner)"
        fillOpacity="0.25"
      />
      <path
        d="M60.4997 28.125L34.833 37.6607V61.5C34.833 75.8036 46.0622 87.7232 60.4997 95.6696C74.9372 87.7232 86.1663 75.8036 86.1663 61.5V37.6607L60.4997 28.125Z"
        stroke="url(#essential-shield-border)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ImportantOutcomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-20 w-16 shrink-0 sm:h-24 sm:w-20"
      viewBox="20 17 81 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="important-shield-solid"
          x1="22.0003"
          y1="17"
          x2="98.1742"
          y2="106.702"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C39740" />
          <stop offset="1" stopColor="#C39740" />
        </linearGradient>
        <linearGradient
          id="important-shield-dark"
          x1="22"
          y1="17"
          x2="98.1738"
          y2="106.702"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C39740" />
          <stop offset="1" stopColor="#1F1604" />
        </linearGradient>
        <linearGradient
          id="important-shield-light"
          x1="21.9997"
          y1="17"
          x2="98.1735"
          y2="106.702"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C39740" />
          <stop offset="1" stopColor="#FFF4DF" />
        </linearGradient>
      </defs>

      <path
        d="M60.5003 20.1786L28.417 32.8929V61.5C28.417 78.9822 42.8545 93.2857 60.5003 102.821C78.1462 93.2857 92.5837 78.9822 92.5837 61.5V32.8929L60.5003 20.1786Z"
        fill="url(#important-shield-solid)"
        fillOpacity="0.15"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.0194 51.08L56.2795 61.2205L50.2734 74.2161L55.9303 74.3145L59.2128 66.8322L62.6348 74.413L68.2917 74.2161L61.9364 61.0236C61.9364 61.0236 64.2528 55.9369 65.4982 53.7382C66.6904 51.6335 68.0124 49.5704 69.4092 47.8311C70.7843 46.1187 72.6566 44.4345 73.8788 43.3023C74.7934 42.4551 76.7422 41.038 76.7422 41.038C76.7422 41.038 70.4889 43.3247 68.8504 44.6807C67.8468 45.5113 66.7576 46.4271 65.7776 47.4373C64.6951 48.553 63.4079 49.9236 62.3555 51.3754C61.273 52.8686 59.2826 56.3964 59.2826 56.3964L56.9779 50.9815L52.0194 51.08Z"
        fill="#FF7300"
      />
      <path
        d="M60.5 23.3572L31.625 34.4822V61.5C31.625 77.3929 44.4583 90.9018 60.5 99.6429C76.5417 90.9018 89.375 77.3929 89.375 61.5V34.4822L60.5 23.3572Z"
        fill="url(#important-shield-dark)"
        fillOpacity="0.25"
      />
      <path
        d="M60.4997 28.125L34.833 37.6607V61.5C34.833 75.8036 46.0622 87.7232 60.4997 95.6696C74.9372 87.7232 86.1663 75.8036 86.1663 61.5V37.6607L60.4997 28.125Z"
        stroke="url(#important-shield-light)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function RedOutcomeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      viewBox="0 0 71 71"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="36.5131"
        cy="35.4999"
        r="32.9643"
        fill="#B63B3B"
        fillOpacity="0.26"
      />
      <circle
        cx="36.5145"
        cy="35.5"
        r="30.4286"
        fill="#B63B3B"
        fillOpacity="0.26"
      />
      <circle
        cx="35.5"
        cy="35.5"
        r="35.5"
        fill="#B63B3B"
        fillOpacity="0.2"
      />
      <circle
        cx="36.2599"
        cy="35.7536"
        r="20.5607"
        stroke="#C37878"
        strokeWidth="3"
      />
      <path
        d="M19.7793 49.1929L50.715 22.3143"
        stroke="#C37878"
        strokeWidth="3"
      />
      <path
        d="M49 50L22 21"
        stroke="#C37878"
        strokeWidth="3"
      />
    </svg>
  );
}

function PurpleOutcomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-16 shrink-0"
      viewBox="0 0 74 74"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clarification-purple-icon-clip)">
        <mask
          id="clarification-purple-icon-mask"
          style={{ maskType: "luminance" }}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="74"
          height="74"
        >
          <path
            d="M0 37C0 16.5655 16.5655 0 37 0C57.4346 0 74 16.5655 74 37C74 57.4346 57.4346 74 37 74C16.5655 74 0 57.4346 0 37Z"
            fill="white"
          />
        </mask>
        <g mask="url(#clarification-purple-icon-mask)">
          <path
            d="M72.9424 37C72.9424 16.5655 56.3769 0 35.9424 0C15.5078 0 -1.05762 16.5655 -1.05762 37C-1.05762 57.4345 15.5078 74 35.9424 74C56.3769 74 72.9424 57.4345 72.9424 37Z"
            fill="#B219F8"
            fillOpacity="0.11"
          />
          <path
            d="M36.9997 71.3572C55.9746 71.3572 71.3569 55.975 71.3569 37C71.3569 18.0251 55.9746 2.64288 36.9997 2.64288C18.0248 2.64288 2.64258 18.0251 2.64258 37C2.64258 55.975 18.0248 71.3572 36.9997 71.3572Z"
            fill="#82557A"
            fillOpacity="0.27"
          />
          <path
            d="M36.9994 68.7143C54.5148 68.7143 68.7137 54.5153 68.7137 37C68.7137 19.4847 54.5148 5.28571 36.9994 5.28571C19.4841 5.28571 5.28516 19.4847 5.28516 37C5.28516 54.5153 19.4841 68.7143 36.9994 68.7143Z"
            fill="#E681E8"
            fillOpacity="0.35"
          />
          <path
            d="M27.4854 27.5036C28.2314 25.3828 29.7039 23.5944 31.6421 22.4554C33.5804 21.3163 35.8592 20.8998 38.075 21.2799C40.2908 21.66 42.3006 22.812 43.7484 24.5319C45.1963 26.2518 45.9887 28.4287 45.9854 30.6768C45.9854 37.0233 36.4656 40.1965 36.4656 40.1965"
            stroke="#F9C6FB"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M36.7217 52.8926H36.7548"
            stroke="#F9C6FB"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
      <defs>
        <clipPath id="clarification-purple-icon-clip">
          <rect width="74" height="74" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function JurisdictionIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.0003 18.3333C14.6027 18.3333 18.3337 14.6024 18.3337 9.99999C18.3337 5.39762 14.6027 1.66666 10.0003 1.66666C5.39795 1.66666 1.66699 5.39762 1.66699 9.99999C1.66699 14.6024 5.39795 18.3333 10.0003 18.3333Z"
        stroke="currentColor"
        strokeWidth="1.09375"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.66699 9.99999C6.66699 6.89727 7.86052 3.91345 10.0003 1.66666C12.1401 3.91345 13.3337 6.89727 13.3337 9.99999C13.3337 13.1027 12.1401 16.0865 10.0003 18.3333C7.86052 16.0865 6.66699 13.1027 6.66699 9.99999Z"
        stroke="currentColor"
        strokeWidth="1.09375"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.66699 10H18.3337"
        stroke="currentColor"
        strokeWidth="1.09375"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} <strong className="font-semibold text-white">{value}</strong>
    </span>
  );
}

function getDetailSections({
  evaluation,
  indirectReasons,
  labels,
  locale,
  unresolved,
}: {
  evaluation: ApplicabilityResultDto["result"];
  indirectReasons: string[];
  labels: ApplicabilityResultCardProps["labels"];
  locale: Locale;
  unresolved: string[];
}): DetailSection[] {
  const entityTypes =
    evaluation.matchedEntityTypes.length > 0 ? (
      <div className="grid gap-3">
        {evaluation.matchedEntityTypes.map((entityType) => (
          <div key={entityType.code}>
            <p className="font-medium text-white">
              {locale === "en" ? entityType.labelEn : entityType.label}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {entityType.legalReference}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <p>{labels.unknown}</p>
    );
  const decisionItems = [
    ...evaluation.scopeBases,
    ...evaluation.obligationOverlays,
  ];
  const legalBases =
    decisionItems.length > 0 ? (
      <div className="grid gap-3">
        {decisionItems.map((item) => (
          <div key={item.code}>
            <p className="text-white">
              {locale === "en" ? item.descriptionEn : item.description}
            </p>
            {item.legalReference ? (
              <p className="mt-1 text-xs text-zinc-500">
                {item.legalReference}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    ) : (
      <p>{labels.unknown}</p>
    );

  const sections: DetailSection[] = [
    {
      content: entityTypes,
      icon: CapturedEntityTypesIcon,
      id: "entity-types",
      title: labels.entityTypes,
    },
    {
      content: legalBases,
      icon: FileText,
      id: "legal-bases",
      title: labels.legalBasis,
    },
    {
      content: (
        <BulletList
          values={
            indirectReasons.length > 0
              ? indirectReasons
              : [labels.indirectNone]
          }
        />
      ),
      icon: IndirectExposureIcon,
      id: "indirect-exposure",
      title: labels.indirect,
    },
  ];

  if (unresolved.length > 0) {
    sections.push({
      content: <BulletList values={unresolved} />,
      icon: TriangleAlert,
      id: "unresolved",
      title: labels.unresolved,
    });
  }

  return sections;
}

function BulletList({ values }: { values: string[] }) {
  return (
    <ul className="grid gap-2">
      {values.map((value) => (
        <li key={value} className="flex items-start gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-zinc-500" />
          <span>{value}</span>
        </li>
      ))}
    </ul>
  );
}

function CapturedEntityTypesIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      className={cn(className, "size-3.5")}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.75 13.25V1.25H11.75V13.25M1.25 13.25V7.5H3.75M11.75 5.625H13.75V13.25M6.25 3.75H8.75M6.25 6.25H8.75M6.25 8.75H8.75M6.25 11.25H8.75"
        stroke="#9F9FA9"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DetailChevron({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      className={className}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.25 5.375L7 9.125L10.75 5.375"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IndirectExposureIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      className={cn(className, "size-[15px]")}
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.5 13.75C10.9518 13.75 13.75 10.9518 13.75 7.5C13.75 4.04822 10.9518 1.25 7.5 1.25C4.04822 1.25 1.25 4.04822 1.25 7.5C1.25 10.9518 4.04822 13.75 7.5 13.75Z"
        stroke="#9F9FA9"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 5V7.5"
        stroke="#9F9FA9"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10H7.50625"
        stroke="#9F9FA9"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getOutcomePresentation(outcome: string) {
  if (outcome === "essential_entity") {
    return {
      Icon: ShieldAlert,
      badgeClass:
        "border-[rgba(126,204,114,0.60)] bg-[rgba(126,204,114,0.08)]",
      borderClass: "border-[rgba(70,169,90,0.70)]",
      dotClass: "bg-[#7ECC72]",
      glowClass: "hidden",
      iconClass: "border-[rgba(70,169,90,0.60)] text-[#7ECC72]",
      illustrationClass: "bg-[#00CB11]",
      metricBackgroundClass: "bg-[rgba(70,169,90,0.02)]",
      metricBorderClass: "border-[rgba(70,169,90,0.60)]",
      purpleIcon: false,
      redIcon: false,
      textClass: "text-[#7ECC72]",
    };
  }

  if (outcome === "important_entity") {
    return {
      Icon: BadgeAlert,
      badgeClass:
        "border-[rgba(234,180,70,0.60)] bg-[rgba(234,180,70,0.08)]",
      borderClass: "border-[rgba(255,210,109,0.70)]",
      dotClass: "bg-[#EAB446]",
      glowClass: "hidden",
      iconClass: "border-[rgba(234,180,70,0.60)] text-[#EAB446]",
      illustrationClass: "bg-blue-700",
      metricBackgroundClass: "bg-[#1B1E27]",
      metricBorderClass: "border-[rgba(234,180,70,0.60)]",
      purpleIcon: false,
      redIcon: false,
      textClass: "text-[#EAB446]",
    };
  }

  if (outcome === "not_directly_in_scope") {
    return {
      Icon: CheckCircle2,
      badgeClass:
        "border-[rgba(217,96,94,0.60)] bg-[rgba(217,96,94,0.08)]",
      borderClass:
        "border-[rgba(217,96,94,0.70)] bg-[#1B1E27]",
      dotClass: "bg-[#D9605E]",
      glowClass: "hidden",
      iconClass: "border-[#C37878] text-[#C37878]",
      illustrationClass: "bg-[#B63B3B]",
      metricBackgroundClass: "bg-[#1B1E27]",
      metricBorderClass: "border-[rgba(217,96,94,0.60)]",
      purpleIcon: false,
      redIcon: true,
      textClass: "text-[#D9605E]",
    };
  }

  return {
    Icon: CircleHelp,
    badgeClass: "border-fuchsia-600/50 bg-fuchsia-600/10",
    borderClass: "border-[#6C4275]",
    dotClass: "bg-fuchsia-200",
    glowClass: "hidden",
    iconClass: "border-fuchsia-200/60 text-fuchsia-200",
    illustrationClass: "bg-fuchsia-600",
    metricBackgroundClass: "bg-[#1B1E27]",
    metricBorderClass: "border-[rgba(178,25,248,0.60)]",
    purpleIcon: true,
    redIcon: false,
    textClass: "text-[#F9C6FB]",
  };
}

function getOutcomeCopy(outcome: string, locale: Locale) {
  const copy = {
    de: {
      essential_entity: {
        summary:
          "Ihr Unternehmen fällt direkt in den Anwendungsbereich und gehört zu einer besonders relevanten Einrichtungsgruppe.",
        meaning:
          "Als wesentliche Einrichtung gelten für Sie erhöhte Anforderungen an Risikomanagement, Sicherheitsmaßnahmen und Meldeprozesse. Starten Sie die Gap-Analyse, um konkrete Handlungsfelder zu identifizieren.",
      },
      important_entity: {
        summary:
          "Ihr Unternehmen fällt nach den angegebenen Informationen voraussichtlich direkt als wichtige Einrichtung in den Anwendungsbereich der NIS2-Regelungen.",
        meaning:
          "Als wichtige Einrichtung sind Sie verpflichtet, geeignete technische und organisatorische Maßnahmen zu implementieren. Starten Sie die Gap-Analyse um konkrete Handlungsfelder zu identifizieren.",
      },
      not_directly_in_scope: {
        summary:
          "Auf Grundlage Ihrer Angaben besteht voraussichtlich keine unmittelbare gesetzliche NIS2-Betroffenheit. Indirekte Anforderungen können dennoch bestehen.",
        meaning:
          "Aktuell ergibt sich keine direkte Einstufung nach NIS2. Prüfen Sie dennoch vertragliche Anforderungen, Anforderungen regulierter Kunden und zukünftige Änderungen Ihrer Unternehmensdaten.",
      },
      clarification_required: {
        summary:
          "Eine eindeutige Einstufung ist anhand Ihrer Angaben nicht möglich. Einzelne Punkte müssen genauer geprüft werden.",
        meaning:
          "Prüfen und ergänzen Sie die offenen Angaben. Erst danach ist eine belastbare Einstufung und gegebenenfalls der Start der Gap-Analyse möglich.",
      },
    },
    en: {
      essential_entity: {
        summary:
          "Based on the information provided, your organization is likely directly in scope of NIS2 as an essential entity.",
        meaning:
          "Essential entities are subject to heightened risk-management, security, and incident-reporting requirements. Start the Gap Analysis to identify concrete areas for action.",
      },
      important_entity: {
        summary:
          "Based on the information provided, your organization is likely directly in scope of NIS2 as an important entity.",
        meaning:
          "As an important entity, you must implement appropriate technical and organizational measures. Start the Gap Analysis to identify concrete areas for action.",
      },
      not_directly_in_scope: {
        summary:
          "Based on your information, there is likely no immediate statutory NIS2 applicability. Indirect requirements may still apply.",
        meaning:
          "No direct NIS2 classification currently follows from your information. Continue to review contractual requirements, regulated customers, and changes to your organization.",
      },
      clarification_required: {
        summary:
          "A clear classification is not possible from the information provided. Individual points require further review.",
        meaning:
          "Review and complete the unresolved information. A reliable classification and, where applicable, a Gap Analysis can follow afterward.",
      },
    },
  };

  const localized = copy[locale];
  return (
    localized[outcome as keyof typeof localized] ??
    localized.clarification_required
  );
}

function formatSize(size: string, locale: Locale) {
  const values = {
    de: { small: "Klein", medium: "Mittel", large: "Groß", unknown: "Unklar" },
    en: { small: "Small", medium: "Medium", large: "Large", unknown: "Unknown" },
  };
  return values[locale][size as keyof (typeof values)[Locale]] ?? size;
}

function formatEntityTypes(
  entityTypes: ApplicabilityResultDto["result"]["matchedEntityTypes"],
  locale: Locale,
  fallback: string,
) {
  if (entityTypes.length === 0) return fallback;
  const values = entityTypes.map((entityType) =>
    locale === "en" ? entityType.labelEn : entityType.label,
  );
  return new Intl.ListFormat(locale, {
    style: "short",
    type: "conjunction",
  }).format(values);
}

function formatCountry(
  countryCode: string | null,
  locale: Locale,
  fallback: string,
) {
  if (!countryCode) return fallback;
  const name = new Intl.DisplayNames([locale], { type: "region" }).of(
    countryCode,
  );
  return name ? `${name} (${countryCode})` : countryCode;
}

function formatCountryNames(countryCodes: string[], locale: Locale) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(countryCodes.map((code) => names.of(code) ?? code));
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}
