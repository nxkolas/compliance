import { cn } from "@/src/utils";
import Link from "next/link";

type ApplicabilityResultTabsProps = {
  activeView: "answers" | "overview";
  answersLabel: string;
  baseHref: string;
  locale: "de" | "en";
  overviewLabel: string;
};

export function ApplicabilityResultTabs({
  activeView,
  answersLabel,
  baseHref,
  locale,
  overviewLabel,
}: ApplicabilityResultTabsProps) {
  return (
    <nav
      aria-label={locale === "en" ? "Result views" : "Ergebnisansichten"}
      className="max-w-full overflow-x-auto"
    >
      <div className="inline-flex h-12 min-w-max items-start justify-start">
        <ResultTab
          active={activeView === "overview"}
          href={`${baseHref}/result`}
          label={overviewLabel}
          roundedClassName="rounded-t-lg"
        />
        <ResultTab
          active={activeView === "answers"}
          className="w-28"
          href={`${baseHref}/answers`}
          label={answersLabel}
          roundedClassName="rounded-t-xl"
        />
        <div
          aria-hidden="true"
          className="h-12 w-36 shrink-0 border-b-2 border-transparent px-5 py-2.5"
        />
      </div>
    </nav>
  );
}

function ResultTab({
  active,
  className,
  href,
  label,
  roundedClassName,
}: {
  active: boolean;
  className?: string;
  href: string;
  label: string;
  roundedClassName: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-12 shrink-0 flex-col items-center justify-center border-b-[1.5px] border-border px-5 py-2.5 text-foreground-subtle/60 transition-colors hover:text-muted-foreground",
        roundedClassName,
        active &&
          "border-b-2 border-foreground text-foreground hover:text-foreground",
        className,
      )}
    >
      <span className="text-center font-['Space_Grotesk'] text-base leading-5 font-medium">
        {label}
      </span>
    </Link>
  );
}
