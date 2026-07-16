import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Locale } from "@/lib/i18n-config";
import { cn } from "@/lib/utils";
import type { ApplicabilityResultDto } from "@/src/server/applicability-check/service";

type ApplicabilityResultCardProps = {
  result: ApplicabilityResultDto;
  locale: Locale;
  labels: {
    ruleSet: string;
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
    outcomes: {
      essentialEntity: string;
      importantEntity: string;
      notDirectlyInScope: string;
      clarificationRequired: string;
    };
  };
  title: string;
};

export function ApplicabilityResultCard({
  result,
  locale,
  labels,
  title,
}: ApplicabilityResultCardProps) {
  const evaluation = result.result;
  const presentation = getOutcomePresentation(evaluation.outcome);
  const reasons = locale === "en" ? evaluation.reasonsEn : evaluation.reasons;
  const unresolved =
    locale === "en"
      ? evaluation.unresolvedFactsEn
      : evaluation.unresolvedFacts;
  const indirectReasons =
    locale === "en"
      ? evaluation.indirectExposure.reasonsEn
      : evaluation.indirectExposure.reasons;

  return (
    <Card className="overflow-hidden rounded-lg shadow-sm">
      <div className={cn("h-2", presentation.barClass)} />
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>
          {labels.ruleSet}: {result.ruleSetVersionLabel ?? labels.unknown} |{" "}
          {labels.revision} {result.artifactRevisionNumber}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={labels.outcome} value={getOutcomeLabel(evaluation.outcome, labels.outcomes)} />
          <Metric label={labels.size} value={formatSize(evaluation.sizeClassification, locale)} />
          <Metric
            label={labels.jurisdiction}
            value={evaluation.jurisdiction.countryCode ?? labels.unknown}
          />
          <Metric label={labels.profile} value={evaluation.jurisdiction.countryProfileVersion ?? evaluation.profileVersion} />
        </div>

        <ResultSection title={labels.reasoning} values={reasons} />

        {evaluation.matchedEntityTypes.length > 0 ? (
          <div>
            <h2 className="text-base font-semibold">{labels.entityTypes}</h2>
            <div className="mt-3 grid gap-2">
              {evaluation.matchedEntityTypes.map((entityType) => (
                <div key={entityType.code} className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
                  <p className="font-medium">
                    {locale === "en" ? entityType.labelEn : entityType.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entityType.legalReference}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {evaluation.scopeBases.length > 0 ? (
          <div>
            <h2 className="text-base font-semibold">{labels.legalBasis}</h2>
            <div className="mt-3 grid gap-2">
              {evaluation.scopeBases.map((item) => (
                <DecisionItem key={item.code} item={item} locale={locale} />
              ))}
            </div>
          </div>
        ) : null}

        {unresolved.length > 0 ? (
          <ResultSection title={labels.unresolved} values={unresolved} tone="warning" />
        ) : null}

        {evaluation.obligationOverlays.length > 0 ? (
          <div>
            <h2 className="text-base font-semibold">{labels.overlays}</h2>
            <div className="mt-3 grid gap-2">
              {evaluation.obligationOverlays.map((item) => (
                <DecisionItem key={item.code} item={item} locale={locale} />
              ))}
            </div>
          </div>
        ) : null}

        <ResultSection
          title={labels.indirect}
          values={indirectReasons.length > 0 ? indirectReasons : [labels.indirectNone]}
        />

        <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {locale === "en" ? evaluation.disclaimerEn : evaluation.disclaimer}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function ResultSection({
  title,
  values,
  tone = "default",
}: {
  title: string;
  values: string[];
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        tone === "warning" &&
          "rounded-md border border-amber-300 bg-amber-50 p-4",
      )}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        {values.map((value) => (
          <li key={value} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecisionItem({
  item,
  locale,
}: {
  item: ApplicabilityResultDto["result"]["scopeBases"][number];
  locale: Locale;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
      <p>{locale === "en" ? item.descriptionEn : item.description}</p>
      {item.legalReference ? (
        <p className="mt-1 text-xs text-muted-foreground">{item.legalReference}</p>
      ) : null}
    </div>
  );
}

function getOutcomePresentation(outcome: string) {
  if (outcome === "essential_entity") return { barClass: "bg-red-500" };
  if (outcome === "important_entity") return { barClass: "bg-amber-400" };
  if (outcome === "not_directly_in_scope") return { barClass: "bg-emerald-400" };
  return { barClass: "bg-blue-400" };
}

function getOutcomeLabel(
  outcome: string,
  labels: ApplicabilityResultCardProps["labels"]["outcomes"],
) {
  if (outcome === "essential_entity") return labels.essentialEntity;
  if (outcome === "important_entity") return labels.importantEntity;
  if (outcome === "not_directly_in_scope") return labels.notDirectlyInScope;
  return labels.clarificationRequired;
}

function formatSize(size: string, locale: Locale) {
  const values = {
    de: { small: "Klein", medium: "Mittel", large: "Groß", unknown: "Unklar" },
    en: { small: "Small", medium: "Medium", large: "Large", unknown: "Unknown" },
  };
  return values[locale][size as keyof (typeof values)[Locale]] ?? size;
}
