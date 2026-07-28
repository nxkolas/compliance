import type { Locale } from "@/lib/i18n-config";

const MAX_SECTION_LABEL_LENGTH = 160;

export type GapFindingSource =
  | {
      kind: "document";
      key: string;
      label: string;
      href: string;
      available: true;
      pageNumbers: number[];
      sectionLabels: string[];
    }
  | {
      kind: "legal";
      key: string;
      label: string;
      href: string | null;
      available: boolean;
      pageNumbers: number[];
      sectionLabels: string[];
    }
  | {
      kind: "assessment";
      key: "assessment";
      label: string;
      href: null;
      available: true;
      pageNumbers: [];
      sectionLabels: [];
    };

export type GapFindingSourceEvidence = {
  sourceType: "assessment_answer" | "document_chunk" | "legal_source_chunk";
  pageNumber: number | null;
  sectionLabel: string | null;
  documentSource?: {
    versionId: string | null;
    documentId: string | null;
    title: string | null;
    mimeType: string | null;
    chunkPageNumber: number | null;
    chunkSectionLabel: string | null;
  } | null;
  legalSource?: {
    versionId: string | null;
    title: string | null;
    upstreamUrl: string | null;
    mimeType: string | null;
    chunkPageNumber: number | null;
    chunkSectionLabel: string | null;
  } | null;
};

type MutableSource = {
  kind: GapFindingSource["kind"];
  key: string;
  label: string;
  hrefBase: string | null;
  mimeType: string | null;
  pageNumbers: Set<number>;
  sectionLabels: Set<string>;
};

export function projectGapFindingSources(input: {
  organizationId: string;
  locale: Locale;
  evidence: GapFindingSourceEvidence[];
}): GapFindingSource[] {
  const grouped = new Map<string, MutableSource>();

  for (const evidence of input.evidence) {
    if (evidence.sourceType === "assessment_answer") {
      if (!grouped.has("assessment")) {
        grouped.set("assessment", {
          kind: "assessment",
          key: "assessment",
          label: input.locale === "de" ? "Ihre Angabe" : "Your information",
          hrefBase: null,
          mimeType: null,
          pageNumbers: new Set(),
          sectionLabels: new Set(),
        });
      }
      continue;
    }

    if (
      evidence.sourceType === "document_chunk" &&
      evidence.documentSource?.documentId &&
      evidence.documentSource.title
    ) {
      const key = `document:${evidence.documentSource.documentId}`;
      const source =
        grouped.get(key) ??
        createMutableSource({
          kind: "document",
          key,
          label: evidence.documentSource.title,
          hrefBase: documentSourceAccessPath(
            input.organizationId,
            evidence.documentSource.documentId,
          ),
          mimeType: evidence.documentSource.mimeType,
        });
      addLocation(
        source,
        preferredPageNumber(
          evidence.pageNumber,
          evidence.documentSource.chunkPageNumber,
        ),
        preferredSectionLabel(
          evidence.sectionLabel,
          evidence.documentSource.chunkSectionLabel,
        ),
      );
      grouped.set(key, source);
      continue;
    }

    if (
      evidence.sourceType === "legal_source_chunk" &&
      evidence.legalSource?.versionId &&
      evidence.legalSource.title
    ) {
      const key = `legal:${evidence.legalSource.versionId}`;
      const source =
        grouped.get(key) ??
        createMutableSource({
          kind: "legal",
          key,
          label: evidence.legalSource.title,
          hrefBase: sanitizeOfficialUrl(evidence.legalSource.upstreamUrl),
          mimeType: evidence.legalSource.mimeType,
        });
      addLocation(
        source,
        preferredPageNumber(
          evidence.pageNumber,
          evidence.legalSource.chunkPageNumber,
        ),
        preferredSectionLabel(
          evidence.sectionLabel,
          evidence.legalSource.chunkSectionLabel,
        ),
      );
      grouped.set(key, source);
    }
  }

  return [...grouped.values()].map(finalizeSource);
}

function createMutableSource(input: {
  kind: "document" | "legal";
  key: string;
  label: string;
  hrefBase: string | null;
  mimeType: string | null;
}): MutableSource {
  return {
    ...input,
    label: input.label.trim(),
    pageNumbers: new Set(),
    sectionLabels: new Set(),
  };
}

function addLocation(
  source: MutableSource,
  pageNumber: number | null,
  sectionLabel: string | null,
) {
  if (Number.isInteger(pageNumber) && (pageNumber ?? 0) > 0) {
    source.pageNumbers.add(pageNumber!);
  }
  const section = normalizeSectionLabel(sectionLabel);
  if (section) source.sectionLabels.add(section);
}

function normalizeSectionLabel(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_SECTION_LABEL_LENGTH) : null;
}

function preferredPageNumber(primary: number | null, fallback: number | null) {
  return Number.isInteger(primary) && (primary ?? 0) > 0 ? primary : fallback;
}

function preferredSectionLabel(primary: string | null, fallback: string | null) {
  return normalizeSectionLabel(primary) ?? normalizeSectionLabel(fallback);
}

function finalizeSource(source: MutableSource): GapFindingSource {
  if (source.kind === "assessment") {
    return {
      kind: "assessment",
      key: "assessment",
      label: source.label,
      href: null,
      available: true,
      pageNumbers: [],
      sectionLabels: [],
    };
  }

  const pageNumbers = [...source.pageNumbers].sort((left, right) => left - right);
  const sectionLabels = [...source.sectionLabels].sort((left, right) =>
    left.localeCompare(right),
  );
  const firstPdfPage =
    source.mimeType === "application/pdf" ? pageNumbers[0] : undefined;

  if (source.kind === "document") {
    const href = firstPdfPage
      ? `${source.hrefBase}?page=${firstPdfPage}`
      : source.hrefBase!;
    return {
      kind: "document",
      key: source.key,
      label: source.label,
      href,
      available: true,
      pageNumbers,
      sectionLabels,
    };
  }

  const href =
    source.hrefBase && firstPdfPage
      ? withPageFragment(source.hrefBase, firstPdfPage)
      : source.hrefBase;
  return {
    kind: "legal",
    key: source.key,
    label: source.label,
    href,
    available: Boolean(href),
    pageNumbers,
    sectionLabels,
  };
}

function documentSourceAccessPath(
  organizationId: string,
  documentId: string,
) {
  return `/api/organizations/${encodeURIComponent(
    organizationId,
  )}/documents/${encodeURIComponent(documentId)}/source-access`;
}

function sanitizeOfficialUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function withPageFragment(value: string, page: number) {
  const url = new URL(value);
  url.hash = `page=${page}`;
  return url.toString();
}
