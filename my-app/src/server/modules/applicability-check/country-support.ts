import { parseRuleSetDocument } from "../compliance/nis2/rule-set-schema";

export function getSupportedCountryCodes(ruleSetRules: unknown): string[] {
  const ruleSet = parseRuleSetDocument(ruleSetRules);
  return [
    ...new Set(
      Object.values(ruleSet.countryProfiles)
        .filter((profile) => profile.supported)
        .map((profile) => profile.countryCode.toUpperCase()),
    ),
  ].sort();
}
