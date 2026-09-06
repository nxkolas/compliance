import { describe, expect, it } from "vitest";
import { getDictionaryForLocale } from "@/src/i18n";

describe("privacy content", () => {
  it("contains every provided section and keeps both locales structurally aligned", () => {
    const german = getDictionaryForLocale("de").legal.privacy;
    const english = getDictionaryForLocale("en").legal.privacy;
    const renderedGerman = JSON.stringify(german);

    expect(german.sections).toHaveLength(12);
    expect(renderedGerman).toContain("Verantwortliche");
    expect(renderedGerman).toContain("Verarbeitete Daten und Zwecke");
    expect(renderedGerman).toContain("Supabase");
    expect(renderedGerman).toContain("OpenAI API");
    expect(renderedGerman).toContain("Hosting und technische Protokolle");
    expect(renderedGerman).toContain("Cookies und lokale Speicherung");
    expect(renderedGerman).toContain("Rechtsgrundlagen");
    expect(renderedGerman).toContain("Speicherdauer");
    expect(renderedGerman).toContain("Empfänger und Drittlandübermittlungen");
    expect(renderedGerman).toContain("Automatisierte Entscheidungen");
    expect(renderedGerman).toContain("Ihre Rechte");
    expect(renderedGerman).toContain("Datensicherheit und Änderungen");
    expect(renderedGerman).toContain("Stand: August 2026");
    expect(messageKeys(english)).toEqual(messageKeys(german));
  });
});

function messageKeys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      messageKeys(item, `${prefix}[${index}]`),
    );
  }

  if (!value || typeof value !== "object") return [prefix];

  return Object.entries(value)
    .flatMap(([key, nested]) =>
      messageKeys(nested, prefix ? `${prefix}.${key}` : key),
    )
    .sort();
}
