export type CatalogOption = {
  stableValue: string;
  catalogCode: string;
};

export type CatalogQuestion = {
  id: string;
  stableKey: string;
  options: CatalogOption[];
};

export function catalogOptionsForCountry<T extends CatalogOption>(
  options: T[],
  countryCode: string | null | undefined,
): T[] {
  const catalogCodes = new Set(
    options
      .map((option) => option.catalogCode)
      .filter((code): code is string => Boolean(code && code !== "all")),
  );
  if (catalogCodes.size === 0) return options;

  const nationalCatalogCode = countryCode ? `country:${countryCode}` : null;
  const selectedCatalogCode =
    nationalCatalogCode && catalogCodes.has(nationalCatalogCode)
      ? nationalCatalogCode
      : "eu_core";

  return options.filter((option) => {
    return option.catalogCode === "all" || option.catalogCode === selectedCatalogCode;
  });
}

export function reconcileCatalogAnswers<
  TQuestion extends CatalogQuestion,
  TAnswer extends string | string[],
>(
  questions: TQuestion[],
  answers: Record<string, TAnswer>,
): Record<string, TAnswer> {
  const countryQuestion = questions.find(
    (question) => question.stableKey === "bc.jurisdiction_country",
  );
  const countryAnswer = countryQuestion ? answers[countryQuestion.id] : undefined;
  const countryCode = typeof countryAnswer === "string" ? countryAnswer : null;
  const reconciled = { ...answers };

  for (const question of questions) {
    const answer = reconciled[question.id];
    if (!answer) continue;
    if (!question.options.some((option) => option.catalogCode !== "all")) {
      continue;
    }
    const allowedValues = new Set(
      catalogOptionsForCountry(question.options, countryCode).map(
        (option) => option.stableValue,
      ),
    );
    if (Array.isArray(answer)) {
      const validValues = answer.filter((value) => allowedValues.has(value));
      if (validValues.length === 0) delete reconciled[question.id];
      else reconciled[question.id] = validValues as TAnswer;
    } else if (!allowedValues.has(answer)) {
      delete reconciled[question.id];
    }
  }

  return reconciled;
}
