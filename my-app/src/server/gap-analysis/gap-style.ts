import type { AtomicGapKind } from "./generation-schema-v7";

export function validateAtomicGapStatement(input: {
  statement: string;
  kind: AtomicGapKind;
  locale: "de" | "en";
}): string {
  const statement = input.statement.trim();
  if (!statement) throw new Error("Gap statement must not be blank");
  if (/[\r\n]/.test(statement)) {
    throw new Error("Gap statement must be exactly one line");
  }
  if (/https?:\/\/|www\./iu.test(statement)) {
    throw new Error("Gap statement must not contain a URL");
  }
  if (/\b(?:LEGAL|DOC|Q):[A-Za-z0-9_-]+/u.test(statement)) {
    throw new Error("Gap statement must not contain citation IDs");
  }
  if (/^(?:[-*•]|\d+[.)]|#{1,6}\s)/u.test(statement)) {
    throw new Error("Gap statement must not contain bullets or headings");
  }
  const sentenceEndings = statement.match(/[.!?](?=\s|$)/gu) ?? [];
  if (sentenceEndings.length !== 1 || !/[.!?]$/u.test(statement)) {
    throw new Error("Gap statement must contain exactly one sentence");
  }
  const words =
    statement.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? [];
  if (words.length > 20) {
    throw new Error("Gap statement must contain at most 20 words");
  }
  if (statement.length > 240) {
    throw new Error("Gap statement exceeds the character limit");
  }
  if (
    /^(?:no independently admitted evidence|the supplied evidence|based on the evidence|there is no evidence|keine unabhängig zugelassenen nachweise|die vorgelegten nachweise)/iu.test(
      statement,
    )
  ) {
    throw new Error("Gap statement must not contain an evidentiary preamble");
  }
  if (
    /\b(?:should|must|needs? to|recommend(?:ed)?|implement|introduce|establish|assign|remediate|correct deficiencies|sollte|muss|müssen|empfohlen|einführen|umsetzen|beheben)\b/iu.test(
      statement,
    )
  ) {
    throw new Error("Gap statement must not contain action content");
  }
  const uncertain =
    /\b(?:unclear|unknown|uncertain|not known whether|not (?:evidenced|demonstrated|established|clear)(?: whether)?|unklar|ungewiss|unsicher(?:heit)?|ungeklärt|offen|nicht (?:bekannt|nachgewiesen|belegt|ersichtlich|nachvollziehbar|transparent|geklärt|klar)(?:,? ob)?|keine gesicherten informationen|es fehlen (?:hinweise|nachweise|informationen))\b/iu.test(
      statement,
    ) || /\bgeht\b[^.!?]{0,80}\bnicht hervor\b/iu.test(statement);
  const partial =
    /\b(?:not all|not (?:used|applied|enabled|required|performed|reviewed) for all|only some|partially|partial|incomplete|uneven|nicht alle|nur teilweise|teilweise|unvollständig)\b/iu.test(
      statement,
    );
  const missing =
    /\b(?:missing|absent|there (?:is|are) no|no |does? not|do not|(?:is|are|was|were|has|have) not|cannot|lacks?|without|not implemented|not used|not reviewed|not documented|fehlt|fehlen|fehlend|kein(?:e|er|en|em|es)?|ohne|nicht umgesetzt|nicht verwendet|nicht überprüft|nicht dokumentiert)\b/iu.test(
      statement,
    );
  if (input.kind === "uncertain" && !uncertain) {
    throw new Error("An uncertain gap must use uncertain wording");
  }
  if (input.kind === "missing" && (uncertain || !missing)) {
    throw new Error("A missing gap must use confirmed missing wording");
  }
  if (input.kind === "partial" && (uncertain || !partial)) {
    throw new Error("A partial gap must use partial wording");
  }
  return statement;
}
