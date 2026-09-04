import { describe, expect, it } from "vitest";
import { getDictionaryForLocale } from "@/src/i18n";

describe("static UI dictionaries", () => {
  it("keeps German and English feature keys in parity", () => {
    expect(messageKeys(getDictionaryForLocale("en"))).toEqual(
      messageKeys(getDictionaryForLocale("de")),
    );
  });
});

function messageKeys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      messageKeys(item, `${prefix}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value)
    .flatMap(([key, nested]) =>
      messageKeys(nested, prefix ? `${prefix}.${key}` : key),
    )
    .sort();
}
