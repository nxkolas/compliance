export type NormalizationCode =
  | "normalized_whitespace"
  | "normalized_line_wrap"
  | "normalized_duplicate"
  | "normalized_period";

export type NormalizedValue<T> = {
  value: T;
  codes: NormalizationCode[];
};

export function normalizeOneLine(
  value: string,
  options: { finalPeriod?: boolean } = {},
): NormalizedValue<string> {
  const codes = new Set<NormalizationCode>();
  let normalized = value.trim();
  if (normalized !== value) codes.add("normalized_whitespace");
  if (/[\r\n]/u.test(normalized)) codes.add("normalized_line_wrap");
  normalized = normalized.replace(/\s+/gu, " ");
  if (normalized !== value.trim().replace(/[\r\n]+/gu, " ")) {
    codes.add("normalized_whitespace");
  }
  if (
    options.finalPeriod &&
    normalized &&
    !/[.!?]$/u.test(normalized)
  ) {
    normalized += ".";
    codes.add("normalized_period");
  }
  return { value: normalized, codes: [...codes] };
}

export function normalizeUniqueStrings(
  values: string[],
  locale: "de" | "en",
): NormalizedValue<string[]> {
  const output: string[] = [];
  const codes = new Set<NormalizationCode>();
  const seen = new Set<string>();
  for (const raw of values) {
    const normalized = normalizeOneLine(raw);
    normalized.codes.forEach((code) => codes.add(code));
    const key = normalized.value.toLocaleLowerCase(locale);
    if (seen.has(key)) {
      codes.add("normalized_duplicate");
      continue;
    }
    seen.add(key);
    output.push(normalized.value);
  }
  return { value: output, codes: [...codes] };
}
