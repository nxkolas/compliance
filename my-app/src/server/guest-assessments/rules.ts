export type QuickCheckAnswerMap = Record<string, unknown>;

export type QuickCheckResult = {
  result: "affected" | "possibly_affected" | "not_affected";
  category: "important" | "special_case" | "not_affected" | "unknown";
  summary: string;
  reasoning: string;
};

export function calculateProgress(
  requiredQuestionIds: string[],
  answeredQuestionIds: string[],
) {
  if (requiredQuestionIds.length === 0) return 100;
  const answered = new Set(answeredQuestionIds);
  const completed = requiredQuestionIds.filter((id) => answered.has(id)).length;
  return Math.round((completed / requiredQuestionIds.length) * 100);
}

export function isMeaningfulAnswerValue(
  value: unknown,
  questionType?: string,
) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.every(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      )
    );
  }

  return questionType === "boolean";
}

export function evaluateQuickCheck(
  answers: QuickCheckAnswerMap,
): QuickCheckResult {
  const country = stringValue(answers.country);
  const sector = stringValue(answers.covered_sector);
  const medium = stringValue(answers.medium_threshold);
  const special = stringValue(answers.special_entity);
  const lexSpecialis = stringValue(answers.lex_specialis);

  const requiresReview =
    country !== "DE" ||
    [sector, medium, special, lexSpecialis].includes("unsure") ||
    lexSpecialis === "yes";

  if (requiresReview) {
    return {
      result: "possibly_affected",
      category: "unknown",
      summary: "Eine individuelle Prüfung ist erforderlich.",
      reasoning:
        "Mindestens eine Angabe ist unsicher, grenzüberschreitend oder weist auf eine möglicherweise vorrangige Spezialregelung hin.",
    };
  }

  if (special === "yes") {
    return {
      result: "affected",
      category: "special_case",
      summary: "Ihr Unternehmen könnte unabhängig von seiner Größe erfasst sein.",
      reasoning:
        "Die angegebene Sonderkategorie kann zu einer größenunabhängigen NIS2-Betroffenheit führen.",
    };
  }

  if (sector === "yes" && medium === "yes") {
    return {
      result: "affected",
      category: "important",
      summary: "Ihr Unternehmen ist voraussichtlich von NIS2 betroffen.",
      reasoning:
        "Die Angaben sprechen für einen erfassten Sektor und das Erreichen der maßgeblichen Größenschwelle.",
    };
  }

  if (sector === "no" && special === "no") {
    return {
      result: "not_affected",
      category: "not_affected",
      summary: "Nach Ihren Angaben besteht aktuell keine erkennbare NIS2-Betroffenheit.",
      reasoning:
        "Weder ein erfasster Sektor noch eine größenunabhängige Sonderkategorie wurde angegeben.",
    };
  }

  return {
    result: "possibly_affected",
    category: "unknown",
    summary: "Die Angaben ergeben noch kein eindeutiges Ergebnis.",
    reasoning:
      "Die Kombination aus Sektor- und Größenangaben sollte individuell geprüft werden.",
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
