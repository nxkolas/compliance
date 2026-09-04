import type { AtomicGapKind } from "../gap-analysis/domain";

export function validateGeneratedAction(input: {
  title: string;
  result: string;
  suggestedEvidence: string[];
  locale: "de" | "en";
  gapKinds: AtomicGapKind[];
}) {
  const title = input.title.trim();
  const result = input.result.trim();
  const suggestedEvidence = input.suggestedEvidence.map((item) => item.trim());
  if (!title || !result || suggestedEvidence.some((item) => !item)) {
    throw new Error("Generated action content must not be blank");
  }
  assertOneLine(title, "Action title");
  assertOneLine(result, "Action result");
  const titleWords = lexicalWords(title);
  if (titleWords.length > 12) {
    throw new Error("Action title must contain at most 12 words");
  }
  if (title.length > 120) {
    throw new Error("Action title exceeds 120 characters");
  }
  const resultWords = lexicalWords(result);
  if (resultWords.length > 40) {
    throw new Error("Action result must contain at most 40 words");
  }
  if (result.length > 320) {
    throw new Error("Action result exceeds 320 characters");
  }
  const sentenceEndings =
    result
      .replace(/\b(?:ggf|bzw|ca|d\.?\s*h|z\.?\s*b)\./giu, "")
      .match(/[.!?](?=\s|$)/gu) ?? [];
  if (
    sentenceEndings.length < 1 ||
    sentenceEndings.length > 2 ||
    !/[.!?]$/u.test(result)
  ) {
    throw new Error("Action result must contain one or two sentences");
  }
  if (suggestedEvidence.length < 1 || suggestedEvidence.length > 5) {
    throw new Error("An action must recommend one to five evidence items");
  }
  for (const evidence of suggestedEvidence) {
    assertOneLine(evidence, "Recommended evidence");
    if (lexicalWords(evidence).length > 12) {
      throw new Error("Recommended evidence must contain at most 12 words");
    }
    if (evidence.length > 120) {
      throw new Error("Recommended evidence exceeds 120 characters");
    }
  }
  const combined = [title, result, ...suggestedEvidence].join(" ");
  if (/https?:\/\/|\b(?:LEGAL|DOC|Q|GAP):[A-Za-z0-9_-]+/iu.test(combined)) {
    throw new Error("Generated action content contains a raw identifier");
  }
  if (
    /\b(?:acceptance criteria|assessment rationale|legal analysis|akzeptanzkriterien|bewertungsbegründung|rechtliche analyse)\b/iu.test(
      combined,
    )
  ) {
    throw new Error("Generated action content contains a forbidden label");
  }
  if (
    /\b(?:nis[\s-]?2|bsig|bsi[-\s]+law|legal (?:obligations?|requirements?|duties?)|statutory (?:obligations?|requirements?|duties?)|regulatory (?:obligations?|requirements?|duties?)|required by (?:applicable )?(?:law|laws|legislation)|gesetzlich\w*|rechtlich\w*|regulatorisch\w*)\b/iu.test(
      combined,
    )
  ) {
    throw new Error("Generated action content contains legal analysis");
  }
  if (input.gapKinds.includes("uncertain")) {
    const verificationFirst =
      /^(?:verify|determine|confirm|assess|check|document|review|prüfen|klären|feststellen|dokumentieren|überprüfen)\b/iu.test(
        title,
      ) ||
      /(?:^|\s)(?:prüfen|klären|feststellen|dokumentieren|überprüfen|ermitteln|bewerten|beurteilen|verifizieren|nachweisen|nachvollziehen)(?=\s|$|[,.;])/iu.test(
        title,
      ) ||
      /^(?:verify|determine|confirm|assess|check|document|review|prüfen|klären|feststellen|dokumentieren|überprüfen|ermitteln|bewerten|beurteilen|verifizieren|nachweisen|nachvollziehen|stellen sie fest|ermitteln sie|prüfen sie|überprüfen sie|es (?:ist|muss|soll) .*?(?:prüfen|klären|feststellen|ermitteln|bewerten|beurteilen|verifizieren))\b/iu.test(
        result,
      );
    const conditionalRemediation =
      /^(?:correct|remediate|address|beheben|korrigieren)\b/iu.test(title) &&
      /\b(?:confirmed|identified|verified|bestätigt|festgestellt|nachgewiesen)\b/iu.test(
        title,
      );
    const conditionalMarker =
      /\b(?:if|when|where|unless|depend(?:s|ing)? on|conditional(?:ly)?|only .* if|falls|sofern|wenn|abhängig|bedingt|gegebenenfalls|ggf|sonst|ansonsten|andernfalls|nur|bei|im fall(?:e)?|sollte\w*|eventuell\w*|negativfall|wird|ergibt|erkennt|stellt sich|liegen|besteht|sind|ist dies nicht der fall|fehlt|fehlen|etwaig\w*)\b/iu.test(
        result,
      ) ||
      /\bany\b[^.!?]{0,80}\b(?:identified|confirmed|verified)\b/iu.test(
        result,
      ) ||
      /\b(?:identified|confirmed|verified|identifiziert\w*|festgestellt\w*|erkannt\w*|bestätigt\w*|nachgewiesen\w*)\b[^.!?]{0,40}\b(?:deficien\w*|gap\w*|shortcoming\w*|mängel\w*|mangel\w*|lücke\w*|defizit\w*|schwäch\w*|fehlend\w*)\b/iu.test(
        result,
      );
    const deficiency =
      /\b(?:deficien\w*|gap\w*|lack\w*|missing|absent|inadequate|not adequate|not performed|not documented|shortcoming\w*|mängel\w*|mangel\w*|lücke\w*|defizit\w*|schwäch\w*|fehlt|fehlen|fehlend\w*|keine\w*|unklar|nicht (?:erfolgt|nachweisbar|belegt|nachvollziehbar|vorhanden|gewährleistet)|unzureichend|klärungsbedarf|handlungsbedarf|nachbesser\w*|negativfall)\b/iu.test(
        result,
      );
    const conditionalResult = conditionalMarker && deficiency;
    const containsRemediation =
      /\b(?:correct\w*|remediat\w*|address\w*|fix\w*|implement\w*|introduc\w*|establish\w*|creat\w*|develop\w*|adjust\w*|improv\w*|clos\w*|beheb\w*|korrigier\w*|umsetz\w*|umzusetz\w*|einführ\w*|einzuführ\w*|eingeführ\w*|etablier\w*|erstell\w*|entwickel\w*|anpass\w*|anzupass\w*|verbesser\w*|schließ\w*|einricht\w*|einzuricht\w*|festleg\w*|festzuleg\w*|nachbesser\w*|nachzubesser\w*|ausricht\w*|auszuricht\w*|durchführ\w*|durchzuführ\w*|ergänz\w*|verstärk\w*|schaff\w*|ergreif\w*)\b/iu.test(
        result,
      );
    if (
      (!verificationFirst && !conditionalRemediation) ||
      (containsRemediation && !conditionalResult)
    ) {
      throw new Error(
        "Uncertain gaps require verification-first and conditional remediation language",
      );
    }
  }
  return { title, result, suggestedEvidence };
}

function assertOneLine(value: string, label: string) {
  if (/[\r\n]/u.test(value)) {
    throw new Error(`${label} must be exactly one line`);
  }
}

function lexicalWords(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? [];
}
