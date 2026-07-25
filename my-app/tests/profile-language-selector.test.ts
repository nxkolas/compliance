import { describe, expect, it } from "vitest";
import { getDictionaryForLocale } from "@/lib/i18n";
import { getProfileMenuLanguageOptions } from "@/components/profile-menu";

describe("authenticated profile language selector", () => {
  it("uses shared autonym options and marks the active locale", () => {
    const labels = getDictionaryForLocale("en");

    expect(
      getProfileMenuLanguageOptions("en", labels.languages),
    ).toEqual([
      { locale: "de", label: "Deutsch", active: false },
      { locale: "en", label: "English", active: true },
    ]);
  });
});
