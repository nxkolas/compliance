/**
 * Legal provision keys are stored as `<instrumentCode>.<provisionCode>`, for
 * example `de_bsig.section_30_2_1`. Their localized citation text lives in the
 * release content catalogue under a derived stable key.
 *
 * @see src/server/compliance/nis2/releases/2026-v2/release.ts
 */
export function legalCitationContentKey(provisionKey: string) {
  const separator = provisionKey.indexOf(".");
  if (separator < 1) return null;
  const instrumentCode = provisionKey.slice(0, separator);
  const provisionCode = provisionKey.slice(separator + 1);
  return `nis2.legal.${instrumentCode}.${provisionCode}.citation`;
}

/**
 * Resolves a provision key to its localized citation, e.g.
 * `de_bsig.section_30_2_1` → "BSI-Gesetz, § 30 Absatz 2 Nummer 1".
 * Falls back to the raw key when the catalogue has no entry.
 */
export function legalCitationLabel(
  contentByStableKey: Record<string, string>,
  provisionKey: string,
) {
  const contentKey = legalCitationContentKey(provisionKey);
  if (!contentKey) return provisionKey;
  return contentByStableKey[contentKey] || provisionKey;
}

/** A citation split into the instrument it belongs to and the provision itself. */
export type LegalCitation = { instrument: string; provision: string };

/**
 * Citations are authored as `<instrument>, <provision>`, for example
 * "BSI-Gesetz, § 30 Absatz 2 Nummer 1". Splitting them lets a reader group
 * several provisions under one instrument instead of repeating its name.
 */
export function splitLegalCitation(label: string): LegalCitation {
  const separator = label.indexOf(", ");
  if (separator < 1) return { instrument: "", provision: label };
  return {
    instrument: label.slice(0, separator),
    provision: label.slice(separator + 2),
  };
}

/**
 * "BSI-Gesetz: § 30 Absatz 1, § 38 Absatz 1 · Richtlinie (EU) 2022/2555: Artikel 20 Absatz 1"
 */
export function formatLegalCitations(citations: readonly LegalCitation[]) {
  const byInstrument = new Map<string, string[]>();
  for (const { instrument, provision } of citations) {
    const provisions = byInstrument.get(instrument) ?? [];
    if (!provisions.includes(provision)) provisions.push(provision);
    byInstrument.set(instrument, provisions);
  }
  return [...byInstrument.entries()]
    .map(([instrument, provisions]) =>
      instrument ? `${instrument}: ${provisions.join(", ")}` : provisions.join(", "),
    )
    .join(" · ");
}
