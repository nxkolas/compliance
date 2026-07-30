"use client";

import { ApplicabilityResultTabs } from "@/components/applicability-check/applicability-result-tabs";
import { useSelectedLayoutSegment } from "next/navigation";

type ApplicabilityResultNavigationProps = {
  answersLabel: string;
  baseHref: string;
  locale: "de" | "en";
  overviewLabel: string;
};

export function ApplicabilityResultNavigation({
  answersLabel,
  baseHref,
  locale,
  overviewLabel,
}: ApplicabilityResultNavigationProps) {
  const segment = useSelectedLayoutSegment();

  return (
    <ApplicabilityResultTabs
      activeView={segment === "answers" ? "answers" : "overview"}
      answersLabel={answersLabel}
      baseHref={baseHref}
      locale={locale}
      overviewLabel={overviewLabel}
    />
  );
}
