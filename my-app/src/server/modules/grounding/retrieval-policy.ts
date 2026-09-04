export function isLegalSourceEffectiveOn(
  effectiveFrom: string | null,
  effectiveTo: string | null,
  asOfDate: string,
) {
  return (!effectiveFrom || effectiveFrom <= asOfDate)
    && (!effectiveTo || effectiveTo >= asOfDate);
}
