type MessageObject = Readonly<Record<string, unknown>>;

type MatchingMessageShape<Reference, Candidate> = Reference extends string
  ? Candidate extends string
    ? Candidate
    : never
  : Reference extends readonly (infer ReferenceItem)[]
    ? Candidate extends readonly (infer CandidateItem)[]
      ? readonly MatchingMessageShape<ReferenceItem, CandidateItem>[]
      : never
    : Reference extends MessageObject
      ? Candidate extends MessageObject
        ? {
            [Key in keyof Reference]: Key extends keyof Candidate
              ? MatchingMessageShape<Reference[Key], Candidate[Key]>
              : never;
          } & Record<Exclude<keyof Candidate, keyof Reference>, never>
        : never
      : Candidate extends Reference
        ? Candidate
        : never;

export function defineFeatureMessages<
  const German extends MessageObject,
  const English extends MessageObject,
>(
  messages: {
    de: German;
    en: English & MatchingMessageShape<German, English>;
  },
): { de: German; en: English } {
  return messages;
}
