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
    <footer className="border-t border-[#3D4049] px-6 py-5 sm:px-8">
      <p className="text-xs font-medium tracking-wide text-white uppercase">
        {labels.sources}
      </p>
      {sources.length ? (
        <TooltipProvider>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {visibleSources.map((source) => (
              <SourceChip key={source.key} source={source} labels={labels} />
            ))}
            {hiddenCount ? (
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-lg border-[1.5px] border-[#3D4049] bg-transparent px-3 py-1 text-sm text-stone-300 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002BFF]"
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
        <p className="mt-3 text-sm text-white/60">
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
      <span className="min-w-0 break-words">{source.label}</span>
      {source.href ? (
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : null}
      {unavailable ? (
        <span className="break-words text-white/60">
          · {labels.sourceUnavailable}
        </span>
      ) : null}
    </>
  );
  const className =
    "inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border-[1.5px] border-[#3D4049] bg-transparent px-3 py-1 text-sm text-stone-300";
  const tooltip = [source.label, location, unavailable ? labels.sourceUnavailable : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {source.href ? (
          <a
            className={`${className} transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002BFF]`}
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
            className={`${className} ${
              unavailable ? "border-dashed text-white/60" : ""
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
