const evidenceLabels = {
  de: "Empfohlene Nachweise",
  en: "Suggested evidence",
} as const;

export function serializeActionDescription(
  result: string,
  suggestedEvidence: string[],
  locale: "de" | "en",
) {
  if (!suggestedEvidence.length) return result;
  return `${result}\n\n${evidenceLabels[locale]}: ${suggestedEvidence.join("; ")}`;
}

export function parseActionDescription(
  description: string,
  locale: "de" | "en",
) {
  const separator = `\n\n${evidenceLabels[locale]}: `;
  const separatorIndex = description.lastIndexOf(separator);
  if (separatorIndex < 0) {
    return { result: description, suggestedEvidence: [] as string[] };
  }
  return {
    result: description.slice(0, separatorIndex),
    suggestedEvidence: description
      .slice(separatorIndex + separator.length)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}
