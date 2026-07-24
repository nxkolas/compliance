"use client";

import { useState } from "react";
import { ExternalLink, FileText, Landmark, UserRound } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GapFindingSource } from "@/src/server/gap-analysis/finding-source-projection";
import type { GapLabels } from "./types";

const INITIAL_SOURCE_COUNT = 3;

export function GapFindingSources({
  sources,
  labels,
}: {
  sources: GapFindingSource[];
  labels: GapLabels;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, sources.length - INITIAL_SOURCE_COUNT);
  const visibleSources = expanded
    ? sources
    : sources.slice(0, INITIAL_SOURCE_COUNT);

  return (
    <footer className="mt-5 border-t pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {labels.sources}
      </p>
      {sources.length ? (
        <TooltipProvider>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {visibleSources.map((source) => (
              <SourceChip key={source.key} source={source} labels={labels} />
            ))}
            {hiddenCount ? (
              <button
                type="button"
                className="inline-flex min-h-8 items-center rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={expanded}
                aria-label={
                  expanded
                    ? labels.showFewerSources
                    : labels.showAdditionalSources.replace(
                        "{count}",
                        String(hiddenCount),
                      )
                }
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((value) => !value);
                }}
              >
                {expanded ? labels.showFewerSources : `+${hiddenCount}`}
              </button>
            ) : null}
          </div>
        </TooltipProvider>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.noSources}
        </p>
      )}
    </footer>
  );
}

function SourceChip({
  source,
  labels,
}: {
  source: GapFindingSource;
  labels: GapLabels;
}) {
  const location = describeLocation(source, labels);
  const unavailable =
    source.kind === "legal" && (!source.available || !source.href);
  const accessibleName = [
    source.label,
    location,
    unavailable ? labels.sourceUnavailable : null,
  ]
    .filter(Boolean)
    .join(". ");
  const content = (
    <>
      <SourceIcon kind={source.kind} />
      <span className="min-w-0 truncate">{source.label}</span>
      {source.href ? (
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : null}
      {unavailable ? (
        <span className="truncate text-muted-foreground">
          · {labels.sourceUnavailable}
        </span>
      ) : null}
    </>
  );
  const className =
    "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-foreground";
  const tooltip = [source.label, location, unavailable ? labels.sourceUnavailable : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {source.href ? (
          <a
            className={`${className} max-w-64 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={accessibleName}
            onClick={(event) => event.stopPropagation()}
          >
            {content}
          </a>
        ) : (
          <span
            className={`${className} max-w-64 ${
              unavailable ? "border-dashed text-muted-foreground" : ""
            }`}
            role="note"
            tabIndex={0}
            aria-label={accessibleName}
            onClick={(event) => event.stopPropagation()}
          >
            {content}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function SourceIcon({ kind }: { kind: GapFindingSource["kind"] }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (kind === "document") {
    return <FileText className={className} aria-hidden="true" />;
  }
  if (kind === "legal") {
    return <Landmark className={className} aria-hidden="true" />;
  }
  return <UserRound className={className} aria-hidden="true" />;
}

function describeLocation(source: GapFindingSource, labels: GapLabels) {
  const parts: string[] = [];
  if (source.pageNumbers.length) {
    parts.push(
      `${source.pageNumbers.length === 1 ? labels.page : labels.pages} ${source.pageNumbers.join(", ")}`,
    );
  }
  if (source.sectionLabels.length) {
    parts.push(
      `${source.sectionLabels.length === 1 ? labels.section : labels.sections} ${source.sectionLabels.join(", ")}`,
    );
  }
  return parts.join(" · ");
}
